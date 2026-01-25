/**
 * Form Preview Component
 * Live preview of form using React JSON Schema Form
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { JSONSchema7 } from 'json-schema';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FormPreviewProps {
  schema: JSONSchema7;
  uiSchema?: Record<string, unknown>;
}

export function FormPreview({ schema, uiSchema }: FormPreviewProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({});

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <div className="mb-4">
        <h3 className="font-semibold text-lg">{t('formPreview.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('formPreview.description')}
        </p>
      </div>

      {Object.keys(schema.properties || {}).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>{t('formPreview.addFields')}</p>
        </div>
      ) : (
        <Form
          schema={schema}
          uiSchema={uiSchema}
          validator={validator}
          formData={formData}
          onChange={(e) => setFormData(e.formData)}
          onSubmit={(e) => {
            // Preview mode - show submitted data in the debug section below
            setFormData(e.formData);
          }}
        >
          <div className="flex gap-2 mt-6">
            <Button type="submit">{t('formPreview.submitPreview')}</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormData({})}
            >
              {t('formPreview.reset')}
            </Button>
          </div>
        </Form>
      )}

      {/* Show form data for debugging */}
      {Object.keys(formData).length > 0 && (
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <div className="text-xs font-mono">
            <div className="font-semibold mb-2">{t('formPreview.currentFormData')}</div>
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </Card>
  );
}
