CREATE TABLE spans (
  project_id VARCHAR NOT NULL,
  trace_id VARCHAR NOT NULL,
  span_id VARCHAR NOT NULL,
  parent_span_id VARCHAR,
  service_name VARCHAR NOT NULL,
  operation_name VARCHAR NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status_code VARCHAR NOT NULL DEFAULT 'UNSET',
  attributes JSON NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT (timezone('UTC', current_timestamp)),
  PRIMARY KEY (project_id, trace_id, span_id)
);
CREATE INDEX spans_project_trace_idx ON spans(project_id, trace_id);
CREATE INDEX spans_received_at_idx ON spans(received_at);
CREATE TABLE logs (
  id VARCHAR PRIMARY KEY,
  project_id VARCHAR NOT NULL,
  trace_id VARCHAR,
  service_name VARCHAR NOT NULL,
  severity VARCHAR NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  message VARCHAR NOT NULL,
  attributes JSON NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT (timezone('UTC', current_timestamp))
);
CREATE INDEX logs_project_service_time_idx ON logs(project_id, service_name, timestamp);
CREATE INDEX logs_project_trace_idx ON logs(project_id, trace_id);
CREATE INDEX logs_received_at_idx ON logs(received_at);
