import { NewsItem } from '../../types/models';
import { MediaDisplay } from '../../components/ui/MediaDisplay';
import { Modal } from '../../components/ui/Modal';
import { WhatsAppShareButton } from '../../components/ui/WhatsAppShareButton';

interface NewsDetailModalProps {
  item: NewsItem | null;
  onClose: () => void;
}

export function NewsDetailModal({ item, onClose }: NewsDetailModalProps) {
  return (
    <Modal open={Boolean(item)} onClose={onClose} title={item?.title || ''} maxWidth="xl">
      {item && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-stone-500 dark:text-slate-400">
              Publicado por {item.authorName} · Categoría: {item.type}
            </p>
            <WhatsAppShareButton text={`${item.title} · CMJ Flandes:`} />
          </div>
          {item.imageUrl && (
            <MediaDisplay
              src={item.imageUrl}
              alt={item.title}
              className="max-h-[460px] w-full rounded-lg"
            />
          )}
          <p className="cmj-prose whitespace-pre-line text-sm text-stone-700 dark:text-slate-200">
            {item.content}
          </p>
          {item.tags && item.tags.length > 0 && (
            <p className="border-t border-stone-200 pt-3 text-xs text-stone-500 dark:border-slate-800 dark:text-slate-400">
              Etiquetas: {item.tags.join(' · ')}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
