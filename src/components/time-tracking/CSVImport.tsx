import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Task, Category } from '@/types';
import { Upload } from 'lucide-react';

interface CSVImportProps {
  onImport: (tasks: Task[]) => void;
}

function generateTaskId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function parseTimeToHour(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error(`Format d'heure invalide: ${time}`);
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || (minutes !== 0 && minutes !== 30)) {
    throw new Error(`Heure invalide: ${time} (seules les heures pleines et demi-heures sont supportées)`);
  }
  return hours + (minutes === 30 ? 0.5 : 0);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Double quote inside quoted field
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ';' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }
  
  result.push(current);
  return result;
}

export default function CSVImport({ onImport }: CSVImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner un fichier CSV',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
      
      if (lines.length === 0) {
        throw new Error('Le fichier CSV est vide');
      }

      // Parse header
      const headerLine = lines[0];
      const expectedHeader = 'date;heure_debut;heure_fin;categorie;client;projet;devis;type;description;duree_h;facturee';
      
      if (headerLine !== expectedHeader) {
        throw new Error(
          `En-tête CSV incorrect. Attendu:\n${expectedHeader}\n\nReçu:\n${headerLine}`
        );
      }

      const tasks: Task[] = [];
      const errors: string[] = [];

      // Parse data lines
      for (let i = 1; i < lines.length; i++) {
        const lineNum = i + 1;
        try {
          const fields = parseCSVLine(lines[i]);
          
          if (fields.length !== 11) {
            throw new Error(`Ligne ${lineNum}: Nombre de colonnes incorrect (${fields.length}/11)`);
          }

          const [
            dateISO,
            heureDebut,
            heureFin,
            categorie,
            client,
            projet,
            devis,
            type,
            description,
            dureeH,
            facturee
          ] = fields;

          // Validate date format
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
            throw new Error(`Ligne ${lineNum}: Format de date invalide (attendu: YYYY-MM-DD)`);
          }

          // Parse hours
          const startHour = parseTimeToHour(heureDebut);
          const endHour = parseTimeToHour(heureFin);

          if (startHour >= endHour) {
            throw new Error(`Ligne ${lineNum}: L'heure de fin doit être supérieure à l'heure de début`);
          }

          // Validate category
          if (categorie !== 'FACTURABLE' && categorie !== 'NON_FACTURABLE') {
            throw new Error(`Ligne ${lineNum}: Catégorie invalide (${categorie}). Attendu: FACTURABLE ou NON_FACTURABLE`);
          }

          // Parse billed status for billable tasks
          let billed = false;
          if (categorie === 'FACTURABLE' && facturee) {
            if (facturee.toLowerCase() === 'oui') {
              billed = true;
            } else if (facturee.toLowerCase() === 'non') {
              billed = false;
            } else {
              throw new Error(`Ligne ${lineNum}: Valeur 'facturee' invalide (${facturee}). Attendu: 'oui' ou 'non'`);
            }
          }

          const task: Task = {
            id: generateTaskId(),
            dateISO,
            startHour,
            endHour,
            category: categorie as Category,
            client: client || undefined,
            project: projet || undefined,
            quote: devis || undefined,
            type: type || undefined,
            description: description || undefined,
            billed
          };

          tasks.push(task);

        } catch (error) {
          errors.push(`Ligne ${lineNum}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        }
      }

      if (errors.length > 0) {
        toast({
          title: 'Erreurs d\'import',
          description: `${errors.length} erreur(s) détectée(s). Voir la console pour les détails.`,
          variant: 'destructive'
        });
        console.error('Erreurs d\'import CSV:', errors);
        return;
      }

      if (tasks.length === 0) {
        toast({
          title: 'Aucune tâche',
          description: 'Aucune tâche valide trouvée dans le fichier CSV',
          variant: 'destructive'
        });
        return;
      }

      onImport(tasks);
      
      toast({
        title: 'Import réussi',
        description: `${tasks.length} tâche(s) importée(s) avec succès`,
      });

    } catch (error) {
      toast({
        title: 'Erreur d\'import',
        description: error instanceof Error ? error.message : 'Erreur inconnue lors de l\'import',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className="font-poppins"
      >
        <Upload className="w-4 h-4 mr-2" />
        {isProcessing ? 'Import en cours...' : 'Importer CSV'}
      </Button>
    </div>
  );
}