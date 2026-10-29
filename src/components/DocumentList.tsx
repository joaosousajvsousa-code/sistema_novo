import { FileText, ImageIcon } from 'lucide-react';
import type { DocumentRow } from '@/lib/documents';
import { formatDateTime } from '@/lib/format';

export function DocumentList({ docs }: { docs: DocumentRow[] }) {
  if (!docs.length) return <p className="text-sm text-pedra-500">Nenhum comprovante anexado.</p>;
  return (
    <ul className="divide-y divide-pedra-100 rounded-md border border-pedra-200">
      {docs.map((d) => {
        const Icon = d.mime_type === 'application/pdf' ? FileText : ImageIcon;
        return (
          <li key={d.id}>
            <a href={`/documentos/${d.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2.5 hover:bg-pedra-100/60">
              <Icon className="h-5 w-5 shrink-0 text-manto" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-manto">{d.file_name}</span>
                <span className="block text-xs text-pedra-500">{formatDateTime(d.created_at)}</span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
