import { Download, Paperclip } from 'lucide-react';
import { useReceipt } from '../../hooks/queries';
import { Modal } from '../ui/Modal';
import { ErrorNote, Spinner } from '../ui/bits';
import { errorMessage } from '../../lib/errors';

export default function ReceiptViewer({ expenseId, title, onClose }: { expenseId: string; title: string; onClose: () => void }) {
  const { data, isLoading, error } = useReceipt(expenseId);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={<Paperclip className="h-5 w-5" />}
      title="Receipt"
      subtitle={title}
      footer={
        data ? (
          <a className="btn-secondary" href={data.dataUrl} download="settlehub-receipt.jpg">
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        ) : undefined
      }
    >
      {isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      <ErrorNote message={error ? errorMessage(error) : null} />
      {data && <img src={data.dataUrl} alt={`Receipt for ${title}`} className="mx-auto max-h-[65vh] rounded-xl object-contain" />}
    </Modal>
  );
}
