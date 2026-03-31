import { Trash2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title = "حذف المادة",
  description = "هل أنت متأكد من حذف هذه المادة؟ لا يمكن التراجع عن هذا الإجراء.",
  onConfirm,
}: DeleteConfirmDialogProps) {
  const handleConfirm = () => {
    onOpenChange(false);
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-[320px] rounded-3xl border border-white/10 bg-card/95 backdrop-blur-xl p-0 shadow-2xl shadow-black/60 [&>button]:hidden"
      >
        <div className="flex flex-col items-center gap-4 p-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/15 flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-destructive" />
          </div>

          <div className="flex flex-col items-center gap-1.5 text-center">
            <DialogTitle className="text-base font-bold text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </DialogDescription>
          </div>

          <div className="flex gap-2 w-full mt-1">
            <button
              onClick={() => onOpenChange(false)}
              className="flex-1 h-11 rounded-2xl bg-white/5 hover:bg-white/10 text-sm font-medium text-muted-foreground hover:text-white transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 h-11 rounded-2xl bg-destructive/90 hover:bg-destructive text-sm font-bold text-white transition-colors flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4" />
              حذف
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
