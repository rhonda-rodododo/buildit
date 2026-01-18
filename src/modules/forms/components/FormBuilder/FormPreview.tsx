/**
 * Form Preview Component
 * Live preview of form using React JSON Schema Form
 */

import { useState } from 'react';
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
  const [formData, setFormData] = useState({});

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <div className="mb-4">
        <h3 className="font-semibold text-lg">Form Preview</h3>
        <p className="text-sm text-muted-foreground">
          This is how your form will appear to users
        </p>
      </div>

      {Object.keys(schema.properties || {}).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Add fields to see the preview</p>
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
            <Button type="submit">Submit Preview</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormData({})}
            >
              Reset
            </Button>
          </div>
        </Form>
      )}

      {/* Show form data for debugging */}
      {Object.keys(formData).length > 0 && (
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <div className="text-xs font-mono">
            <div className="font-semibold mb-2">Current Form Data:</div>
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </Card>
  );
}
