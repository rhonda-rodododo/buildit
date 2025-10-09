/**
 * Public Form View Component
 * Renders a published form for public submission using RJSF
 */

import { useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import type { RJSFSchema } from '@rjsf/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2 } from 'lucide-react';
import type { Form as FormType } from '../../types';
import { AntiSpamProtection } from './AntiSpamProtection';

interface PublicFormViewProps {
  form: FormType;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}

export function PublicFormView({ form, onSubmit }: PublicFormViewProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [honeypotValue, setHoneypotValue] = useState('');

  const handleSubmit = async (data: { formData?: Record<string, unknown> }) => {
    // Check honeypot
    if (honeypotValue !== '') {
      console.warn('Honeypot triggered - likely spam');
      // Silently reject (don't show error to bot)
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(data.formData || {});
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  if (form.status !== 'published') {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">This form is not currently published.</p>
      </Card>
    );
  }

  if (submitted) {
    return (
      <Card className="p-12 text-center space-y-4">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
        <div>
          <h3 className="text-xl font-semibold">Thank you!</h3>
          <p className="text-muted-foreground mt-2">
            {form.settings.confirmationMessage || 'Your submission has been received.'}
          </p>
        </div>
        {form.settings.redirectUrl && (
          <Button
            onClick={() => window.location.href = form.settings.redirectUrl!}
          >
            Continue
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{form.title}</h1>
          {form.description && (
            <p className="text-muted-foreground mt-2">{form.description}</p>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {form.schema && (
          <Form
            schema={form.schema as RJSFSchema}
            uiSchema={form.uiSchema}
            validator={validator}
            formData={formData}
            onChange={(e) => setFormData(e.formData)}
            onSubmit={handleSubmit}
            disabled={submitting}
          >
            {/* Anti-spam honeypot */}
            <AntiSpamProtection
              enabled={form.settings.antiSpam.enableHoneypot}
              value={honeypotValue}
              onChange={setHoneypotValue}
            />

            <div className="flex gap-2 mt-6">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </Form>
        )}
      </Card>

      {!form.settings.hideBranding && (
        <div className="text-center text-xs text-muted-foreground">
          Powered by BuildIt Network
        </div>
      )}
    </div>
  );
}
