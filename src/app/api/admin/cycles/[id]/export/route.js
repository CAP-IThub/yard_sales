import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isAdmin } from '@/lib/rbac';
import prisma from '@/lib/db';

function toCSV(rows){
  if(!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => '"' + String(v).replace(/"/g,'""') + '"';
  return [headers.join(','), ...rows.map(r => headers.map(h=>escape(r[h]??'')).join(','))].join('\n');
}

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if(!session || !isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const cycleId = params.id;
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if(!cycle) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if(!['CLOSED','ARCHIVED'].includes(cycle.status)) return NextResponse.json({ error: 'Export only after close' }, { status: 400 });

  const url = new URL(req.url);
  const format = url.searchParams.get('format'); // csv (default) | pdf | xlsx (re-added with caution)

  const bids = await prisma.bid.findMany({ where: { cycleId }, include: { user: true, item: true } });
  const items = await prisma.item.findMany({ where: { cycleId } });

  if(format === 'xlsx') {
    // NOTE: sheetJS (xlsx) has outstanding advisories; internal-only use accepted. Review before external exposure.
    const XLSX = (await import('xlsx')).default || (await import('xlsx'));
    const wb = XLSX.utils.book_new();
    const claimersMap = new Map();
    bids.forEach(b=>{ if(!claimersMap.has(b.itemId)) claimersMap.set(b.itemId,new Set()); claimersMap.get(b.itemId).add(b.userId); });
    const itemsSheet = XLSX.utils.json_to_sheet(items.map(it => ({
      ID: it.id,
      Name: it.name,
      TotalQty: it.totalQty,
      AllocatedQty: it.allocatedQty,
      PercentFilled: it.totalQty? Math.round((it.allocatedQty/it.totalQty)*100):0,
      Claimers: claimersMap.get(it.id)?.size || 0
    })));
    const bidsSheet = XLSX.utils.json_to_sheet(bids.map(b => ({ ID: b.id, User: b.user.email, Item: b.item.name, Qty: b.qty, CreatedAt: b.createdAt.toISOString() })));
    XLSX.utils.book_append_sheet(wb, itemsSheet, 'Items');
    XLSX.utils.book_append_sheet(wb, bidsSheet, 'Bids');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    return new Response(buffer, { status: 200, headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="cycle-${cycleId}-results.xlsx"`
    }});
  }

  if(format === 'pdf') {
    const { PDFDocument, StandardFonts, rgb, grayscale } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 40;
    const metaGenerated = new Date().toISOString();
    let page = pdfDoc.addPage();
    let { width, height } = page.getSize();
    let y = height - margin;
    let pageNumber = 1;

    function addFooter() {
      page.drawText(`Page ${pageNumber}`, { x: width - margin - 50, y: margin/2, size: 8, font });
      page.drawText(`Generated: ${metaGenerated}`, { x: margin, y: margin/2, size: 6, font, color: grayscale(0.5) });
    }
    function ensureSpace(rowHeight){
      if(y - rowHeight < margin){
        addFooter();
        pageNumber++;
        page = pdfDoc.addPage();
        ({ width, height } = page.getSize());
        y = height - margin;
      }
    }
    function drawText(txt, opts){
      const { x=margin, size=10, bold=false, color=grayscale(0), maxWidth } = opts || {};
      page.drawText(txt, { x, y, size, font: bold?fontBold:font, color, maxWidth });
      y -= size + 4;
    }
    function drawTable({ title, headers, rows, widths }){
      if(title){ drawText(title,{ bold:true, size:12 }); }
      const headerHeight = 14;
      ensureSpace(headerHeight+4);
      // header background
      let xPos = margin;
      headers.forEach((h,i)=>{
        page.drawRectangle({ x: xPos, y: y - headerHeight + 4, width: widths[i], height: headerHeight, color: grayscale(0.9) });
        page.drawText(h, { x: xPos+4, y: y - headerHeight + 8, size:8, font: fontBold, color: grayscale(0) });
        xPos += widths[i];
      });
      y -= headerHeight + 6;
      const rowH = 12;
      rows.forEach(r => {
        ensureSpace(rowH+2);
        let x = margin;
        r.forEach((cell,i)=>{
          const text = String(cell ?? '');
          page.drawText(text.length>40 && widths[i]>120? text.slice(0,38)+'…' : text, { x: x+4, y: y+2, size:8, font, color: grayscale(0.1) });
          x += widths[i];
        });
        y -= rowH;
      });
      y -= 4;
    }

    // Title & metadata
    drawText(`Cycle Results: ${cycle.name}`, { bold:true, size:18 });
    drawText(`Status: ${cycle.status}    Items: ${items.length}    Bids: ${bids.length}`, { size:9, color: grayscale(0.4) });
    drawText(`Generated at: ${metaGenerated}`, { size:7, color: grayscale(0.5) });

    // Build claimers map
    const claimersMap = new Map();
    bids.forEach(b=>{ if(!claimersMap.has(b.itemId)) claimersMap.set(b.itemId,new Set()); claimersMap.get(b.itemId).add(b.userId); });

    // Items table
    const itemRows = items.map(it => [
      it.name,
      it.allocatedQty,
      it.totalQty,
      it.totalQty? Math.round((it.allocatedQty/it.totalQty)*100)+'%' : '0%',
      claimersMap.get(it.id)?.size || 0
    ]);
    drawTable({
      title: 'Items Allocation',
      headers: ['Item','Allocated','Total','% Filled','Claimers'],
      rows: itemRows,
      widths: [220,70,60,70,70]
    });

    // Users table
    const perUser = new Map();
    bids.forEach(b => { if(!perUser.has(b.user.email)) perUser.set(b.user.email,0); perUser.set(b.user.email, perUser.get(b.user.email)+b.qty); });
    const usersAgg = Array.from(perUser.entries()).sort((a,b)=>b[1]-a[1]);
    const userRows = usersAgg.map(([email,total])=>[email,total]);
    drawTable({
      title: 'User Totals',
      headers: ['User','Total Qty'],
      rows: userRows,
      widths: [350,80]
    });

    addFooter();
    const pdfBytes = await pdfDoc.save();
    return new Response(Buffer.from(pdfBytes), { status: 200, headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="cycle-${cycleId}-results.pdf"`
    }});
  }

  // Default CSV multipart export
  const bidsCsv = toCSV(bids.map(b => ({ id: b.id, user: b.user.email, item: b.item.name, qty: b.qty, createdAt: b.createdAt.toISOString() })));
  const itemsCsv = toCSV(items.map(it => ({ id: it.id, name: it.name, totalQty: it.totalQty, allocatedQty: it.allocatedQty })));
  const boundary = 'CSV_BOUNDARY_' + Date.now();
  const body = `--${boundary}\nContent-Type: text/csv; charset=utf-8\nContent-Disposition: attachment; filename="items.csv"\n\n${itemsCsv}\n--${boundary}\nContent-Type: text/csv; charset=utf-8\nContent-Disposition: attachment; filename="bids.csv"\n\n${bidsCsv}\n--${boundary}--`;
  return new Response(body, { status: 200, headers: { 'Content-Type': `multipart/mixed; boundary=${boundary}` } });
}
