import React from 'react';
import { TenkoExamination } from '../../types';
import { DigitalTenkoCard } from './DigitalTenkoCard';
import { X } from 'lucide-react';

interface DigitalTenkoCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  examination: TenkoExamination | null;
  onPrint?: () => void;
}

export const DigitalTenkoCardModal: React.FC<DigitalTenkoCardModalProps> = ({
  isOpen,
  onClose,
  examination,
  onPrint,
}) => {
  if (!isOpen || !examination) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative max-w-xl w-full my-8 bg-transparent">
        {/* Floating Close Button */}
        <div className="flex justify-end mb-2">
          <button
            type="button"
            id="btn-close-digital-card-modal"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-slate-950 flex items-center justify-center shadow-lg transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card Component */}
        <DigitalTenkoCard
          examination={examination}
          showActions={true}
          onPrint={onPrint}
        />
      </div>
    </div>
  );
};
