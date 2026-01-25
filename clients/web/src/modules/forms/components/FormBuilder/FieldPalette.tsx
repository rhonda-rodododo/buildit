/**
 * Field Palette Component
 * Draggable field types for form builder
 */

import { useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import {
  Type,
  Hash,
  Mail,
  Phone,
  Calendar,
  Link as LinkIcon,
  CheckSquare,
  List,
  Circle,
  FileUp,
  AlignLeft,
} from 'lucide-react';

interface FieldType {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const FIELD_TYPES: FieldType[] = [
  {
    type: 'text',
    label: 'Text',
    icon: Type,
    description: 'Single line text input',
  },
  {
    type: 'textarea',
    label: 'Textarea',
    icon: AlignLeft,
    description: 'Multi-line text input',
  },
  {
    type: 'email',
    label: 'Email',
    icon: Mail,
    description: 'Email address input',
  },
  {
    type: 'phone',
    label: 'Phone',
    icon: Phone,
    description: 'Phone number input',
  },
  {
    type: 'number',
    label: 'Number',
    icon: Hash,
    description: 'Numeric input',
  },
  {
    type: 'date',
    label: 'Date',
    icon: Calendar,
    description: 'Date picker',
  },
  {
    type: 'url',
    label: 'URL',
    icon: LinkIcon,
    description: 'Website URL input',
  },
  {
    type: 'select',
    label: 'Dropdown',
    icon: List,
    description: 'Dropdown select',
  },
  {
    type: 'radio',
    label: 'Radio Group',
    icon: Circle,
    description: 'Radio button group',
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    icon: CheckSquare,
    description: 'Single checkbox',
  },
  {
    type: 'file',
    label: 'File Upload',
    icon: FileUp,
    description: 'File upload input',
  },
];

function DraggableFieldType({ fieldType }: { fieldType: FieldType }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${fieldType.type}`,
    data: {
      type: fieldType.type,
      fromPalette: true,
    },
  });

  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-3 cursor-move hover:border-primary transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <fieldType.icon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{fieldType.label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {fieldType.description}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function FieldPalette() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-sm mb-3">Field Types</div>
      <div className="space-y-2">
        {FIELD_TYPES.map((fieldType) => (
          <DraggableFieldType key={fieldType.type} fieldType={fieldType} />
        ))}
      </div>
    </div>
  );
}
