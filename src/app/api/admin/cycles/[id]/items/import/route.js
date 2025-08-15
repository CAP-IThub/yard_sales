import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isAdmin } from '@/lib/rbac';
import prisma from '@/lib/db';
import { roundPriceTwoDp } from '@/lib/money';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function normalizeKey(k){
  return String(k||'').toLowerCase().replace(/[^a-z0-9]/g,'');
}

function toNumberOrNull(v){
  if(v===undefined || v===null || v==='') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[\,\s]/g,''));
  return Number.isFinite(n) ? n : null;
}

// Round to 2 decimals with custom rule based on 3rd decimal:
// - If 3rd decimal >= 4, round up the 2nd decimal
// - Else, truncate to 2 decimals
// Examples: 20001.203445 -> 20001.20, 20001.294 -> 20001.30

export async function POST(req, { params: paramsPromise }) {
  const params = await paramsPromise;
  const session = await getServerSession(authOptions);
  if(!session || !isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const cycleId = params.id;

  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if(!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  if(cycle.status !== 'DRAFT') return NextResponse.json({ error: 'Can only import items while cycle is DRAFT' }, { status: 400 });

  const form = await req.formData();
  const file = form.get('file');
  if(!file || typeof file === 'string') return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  let rows = [];
  try {
    const XLSX = (await import('xlsx')).default || (await import('xlsx'));
    let workbook;
    const name = file.name || '';
    if(name.toLowerCase().endsWith('.csv')){
      const text = await file.text();
      workbook = XLSX.read(text, { type: 'string' });
    } else {
      const buf = Buffer.from(await file.arrayBuffer());
      try {
        workbook = XLSX.read(buf, { type: 'buffer' });
      } catch {
        const text = buf.toString('utf8');
        workbook = XLSX.read(text, { type: 'string' });
      }
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 400 });
  }

  if(!Array.isArray(rows) || rows.length === 0){
    return NextResponse.json({ error: 'No rows found in file' }, { status: 400 });
  }
  if(rows.length > 2000) {
    return NextResponse.json({ error: 'Too many rows (limit 2000)' }, { status: 400 });
  }

  const results = { created: 0, failed: 0, errors: [] };
  for(let i=0;i<rows.length;i++){
    const raw = rows[i];
    const map = {};
    for(const k of Object.keys(raw)) map[normalizeKey(k)] = raw[k];
    const name = String(map.name || '').trim();
    if(!name){ results.failed++; results.errors.push({ row: i+2, error: 'Missing name' }); continue; }
    const description = String(map.description || '').trim() || null;
  const priceNum = roundPriceTwoDp(map.price);
  if(priceNum === null || priceNum < 0){ results.failed++; results.errors.push({ row: i+2, error: 'Invalid price' }); continue; }
    const totalQtyNum = Math.floor(Number(toNumberOrNull(map.totalqty)));
    if(!Number.isFinite(totalQtyNum) || totalQtyNum < 1){ results.failed++; results.errors.push({ row: i+2, error: 'Invalid total qty' }); continue; }
    const maxPer = toNumberOrNull(map.maxqtyperuser ?? map.maxperuser ?? map.maxuser);
    const maxQtyPerUser = (maxPer === null || maxPer === undefined || maxPer === '') ? null : Math.floor(Number(maxPer));
    if(maxQtyPerUser !== null && (!Number.isFinite(maxQtyPerUser) || maxQtyPerUser < 1)){
      results.failed++; results.errors.push({ row: i+2, error: 'Invalid MaxQtyPerUser' }); continue; }

    try {
      const data = { name, description: description || undefined, price: priceNum, totalQty: totalQtyNum, cycle: { connect: { id: cycleId } } };
      if(maxQtyPerUser !== null) data.maxQtyPerUser = maxQtyPerUser;
      await prisma.item.create({ data });
      results.created++;
    } catch (e) {
      results.failed++; results.errors.push({ row: i+2, error: 'DB error' });
    }
  }

  return NextResponse.json(results);
}
