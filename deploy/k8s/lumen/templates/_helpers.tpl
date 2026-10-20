{{/* Labels every object carries. */}}
{{- define "lumen.labels" -}}
app.kubernetes.io/part-of: lumen
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{/* The public origin. Cookies and OAuth callbacks depend on its scheme. */}}
{{- define "lumen.origin" -}}
{{- if .Values.tls.enabled -}}https://{{ .Values.ingress.host }}{{- else -}}http://{{ .Values.ingress.host }}{{- end -}}
{{- end -}}

{{/* LUMEN_WORKER: forced by config.worker, else steering when a model key is given. */}}
{{- define "lumen.workerMode" -}}
{{- if .Values.config.worker -}}
{{- .Values.config.worker -}}
{{- else if or .Values.extraSecrets.OPENAI_API_KEY .Values.extraSecrets.DEEPSEEK_API_KEY -}}
steering
{{- else -}}
demo
{{- end -}}
{{- end -}}

{{/*
A value of Secret lumen-core: the one already in the cluster when there is
one, a new random one otherwise. A new password on upgrade would lock the
services out of the database that the PVC still holds.
Call: include "lumen.coreSecret" (list $ "KEY" length)
*/}}
{{- define "lumen.coreSecret" -}}
{{- $root := index . 0 -}}
{{- $key := index . 1 -}}
{{- $length := index . 2 -}}
{{- $existing := lookup "v1" "Secret" $root.Release.Namespace "lumen-core" -}}
{{- if and $existing $existing.data (hasKey $existing.data $key) -}}
{{- index $existing.data $key | b64dec -}}
{{- else -}}
{{- randAlphaNum $length -}}
{{- end -}}
{{- end -}}

{{/*
The environment every app container shares. The URLs use Kubernetes $(VAR)
expansion, so the passwords stay in the Secret and never in a rendered value.
The passwords are alphanumeric, so the URLs need no escaping.
*/}}
{{- define "lumen.appEnv" -}}
- name: POSTGRES_PASSWORD
  valueFrom:
    secretKeyRef: { name: lumen-core, key: POSTGRES_PASSWORD }
- name: RABBITMQ_PASSWORD
  valueFrom:
    secretKeyRef: { name: lumen-core, key: RABBITMQ_PASSWORD }
- name: LUMEN_INTERNAL_KEY
  valueFrom:
    secretKeyRef: { name: lumen-core, key: LUMEN_INTERNAL_KEY }
- name: DATABASE_URL
  value: postgres://lumen:$(POSTGRES_PASSWORD)@postgres:5432/lumen
- name: RABBITMQ_URL
  value: amqp://lumen:$(RABBITMQ_PASSWORD)@rabbitmq:5672
- name: LUMEN_PORT
  value: "4000"
{{- end -}}
