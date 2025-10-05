/**
 * DynamicForm Component
 * Renders a form with custom fields using react-hook-form
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldRenderer } from './FieldRenderer';
import { CustomFieldsManager } from '../customFieldsManager';
import type { CustomField, CustomFieldValues } from '../types';

interface DynamicFormProps {
  fields: CustomField[];
  defaultValues?: CustomFieldValues;
  onSubmit: (values: CustomFieldValues) => void;
  submitLabel?: string;
}

export function DynamicForm({ fields, defaultValues, onSubmit, submitLabel = 'Submit' }: DynamicFormProps) {
  // Generate form schema from custom fields
  const { schema: zodSchemas, defaultValues: fieldDefaults } = CustomFieldsManager.generateFormSchema(fields);
  const formSchema = z.object(zodSchemas);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<CustomFieldValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...fieldDefaults, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            register={register}
            errors={errors}
            value={watch(field.name)}
            onChange={(value) => setValue(field.name, value)}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
