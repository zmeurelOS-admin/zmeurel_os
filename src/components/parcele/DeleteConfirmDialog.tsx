import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  itemName: string;
  itemType: string;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  itemName,
  itemType = "", // Fallback pentru a preveni undefined
}: DeleteConfirmDialogProps) {
  
  const getDeleteMessage = () => {
    // Verificăm dacă itemType există, dacă nu, folosim un string gol
    const type = (itemType || "").toLowerCase();
    
    switch (type) {
      case 'parcelă':
        return 'Parcela va fi ștearsă permanent din sistem, împreună cu toate datele asociate (recoltări, activități).';
      case 'culegător':
        return 'Culegătorul va fi șters permanent din sistem, împreună cu toate datele asociate.';
      case 'client':
        return 'Clientul va fi șters permanent din sistem.';
      case 'investiție':
        return 'Investiția va fi ștearsă permanent din sistem.';
      case 'cheltuială':
        return 'Cheltuiala va fi ștearsă permanent din sistem.';
      default:
        return 'Această înregistrare va fi ștearsă permanent din sistem.';
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Ești absolut sigur?</AlertDialogTitle>
          <AlertDialogDescription>
            Această acțiune nu poate fi anulată. <strong>{itemName}</strong> va fi șters(ă) permanent din sistem.
            <br /><br />
            {getDeleteMessage()}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anulează</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white border-0"
          >
            Șterge
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}