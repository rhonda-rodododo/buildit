/**
 * Form Canvas Component
 * Drop zone for form fields with drag-to-reorder
 */

import { useDroppable, useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, GripVertical } from 'lucide-react';
import type { FormFieldDefinition } from './FormBuilder';

interface FormCanvasProps {
  fields: FormFieldDefinition[];
  selectedFieldId?: string;
  onFieldSelect: (field: FormFieldDefinition) => void;
  onFieldDelete: (fieldId: string) => void;
}

function DraggableField({
  field,
  index,
  isSelected,
  onSelect,
  onDelete,
}: {
  field: FormFieldDefinition;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: field.id,
    data: { index },
  });

  return (
    <Card
      className={`p-4 cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-primary' : ''
      } ${isDragging ? 'opacity-50' : ''} hover:border-primary`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          className="cursor-move mt-1"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">{field.label}</div>
            {field.required && (
              <span className="text-xs text-red-500">Required</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {field.type} {field.helpText && `• ${field.helpText}`}
          </div>
          {field.placeholder && (
            <div className="text-xs text-muted-foreground mt-1 italic">
              Placeholder: {field.placeholder}
            </div>
          )}
          {field.options && field.options.length > 0 && (
            <div className="text-xs text-muted-foreground mt-2">
              Options: {field.options.join(', ')}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex-shrink-0"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </Card>
  );
}

export function FormCanvas({ fields, selectedFieldId, onFieldSelect, onFieldDelete }: FormCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'form-canvas',
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[400px] border-2 border-dashed rounded-lg p-4 transition-colors ${
        isOver ? 'border-primary bg-primary/5' : 'border-muted'
      }`}
    >
      {fields.length === 0 ? (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-lg font-medium">Drag fields here to build your form</p>
            <p className="text-sm mt-1">Select field types from the palette on the left</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <DraggableField
              key={field.id}
              field={field}
              index={index}
              isSelected={selectedFieldId === field.id}
              onSelect={() => onFieldSelect(field)}
              onDelete={() => onFieldDelete(field.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
