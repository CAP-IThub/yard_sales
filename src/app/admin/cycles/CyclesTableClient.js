"use client";
import { useState, Fragment } from 'react';
import CycleActionsClient from './CycleActionsClient';
import ManageItemsClient from './ManageItemsClient';

export default function CyclesTableClient({ cycles }) {
  const [expanded, setExpanded] = useState(()=>{
    const map = {};
    cycles.forEach(c=>{ if(c.status === 'DRAFT') map[c.id] = true; });
    return map;
  });

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const statusColors = {
    DRAFT: 'bg-neutral-700 text-neutral-200',
    OPEN: 'bg-green-600/80 text-white',
    CLOSED: 'bg-red-600/80 text-white',
    ARCHIVED: 'bg-neutral-500/70 text-neutral-100'
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm overflow-hidden shadow divide-y divide-neutral-800">
      <table className="w-full text-sm">
        <thead className="bg-neutral-800/70 text-neutral-300">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium w-6"></th>
            <th className="px-3 py-2 font-medium w-10">#</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Max/User</th>
            <th className="px-3 py-2 font-medium">Open At</th>
            <th className="px-3 py-2 font-medium">Close At</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {cycles.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-neutral-500">No cycles yet.</td>
            </tr>
          )}
          {cycles.map((cycle, i) => {
            const isExpanded = !!expanded[cycle.id];
            return (
              <Fragment key={cycle.id}>
                <tr className={"border-t border-neutral-800 " + (i % 2 === 0 ? 'bg-neutral-900/50' : 'bg-neutral-900/30') }>
                  <td className="px-2 py-2 align-top">
                    {cycle.status === 'DRAFT' && (
                      <button onClick={()=>toggle(cycle.id)} aria-label={isExpanded ? 'Collapse' : 'Expand'} className="text-neutral-400 hover:text-neutral-200 text-xs">
                        {isExpanded ? '−' : '+'}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 text-neutral-500 text-xs align-top">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-neutral-200 align-top">{cycle.name}</td>
                  <td className="px-3 py-2 align-top"><span className={"inline-block px-2 py-1 rounded text-xs font-semibold " + statusColors[cycle.status]}>{cycle.status}</span></td>
                  <td className="px-3 py-2 text-neutral-300 align-top">{cycle.maxItemsPerUser}</td>
                  <td className="px-3 py-2 text-neutral-400 align-top">{cycle.openAt ? new Date(cycle.openAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }) : '-'}</td>
                  <td className="px-3 py-2 text-neutral-400 align-top">{cycle.closeAt ? new Date(cycle.closeAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }) : '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap align-top"><CycleActionsClient cycle={cycle} /></td>
                </tr>
                {cycle.status === 'DRAFT' && isExpanded && (
                  <tr className="border-t border-neutral-800">
                    <td colSpan={8} className="px-3 py-2">
                      <ManageItemsClient cycleId={cycle.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
