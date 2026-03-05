---
template: 'event-catalog'
version: 1.0.0
used_by: ['brownfield-onboarding']
---

# Event & Messaging Catalog: {product_name}

> **Project:** {project_name}
> **Date:** {date}
> **Author:** {agent_name}
> **Mode:** Brownfield — discovered from codebase scan

## 1. Messaging Infrastructure

| Aspect | Detail |
|--------|--------|
| Messaging system(s) | {Kafka / RabbitMQ / SNS-SQS / Redis Pub-Sub / NATS / Other} |
| Client library | {library name and version} |
| Configuration location | {path to config files} |
| Connection management | {connection pooling, retry config} |
| Serialization format | {JSON / Avro / Protobuf / Other} |

## 2. Produced Events

| Event Name | Topic/Queue | Schema | Trigger | Publisher Module |
|------------|-------------|--------|---------|-----------------|
| {event_name} | {topic} | {schema_ref_or_inline} | {what triggers it} | {module/service} |

## 3. Consumed Events

| Event Name | Topic/Queue | Handler | Error Handling | Consumer Module |
|------------|-------------|---------|----------------|-----------------|
| {event_name} | {topic} | {handler_function} | {retry/DLQ/ignore} | {module/service} |

## 4. External Events

| Event Name | Source Service | Topic/Queue | Direction | Schema |
|------------|---------------|-------------|-----------|--------|
| {event_name} | {service_name} | {topic} | {Consumed / Produced} | {schema_ref} |

## 5. Delivery Guarantees & Configuration

| Aspect | Configuration |
|--------|--------------|
| Delivery guarantee | {At-least-once / At-most-once / Exactly-once} |
| Retry policy | {max retries, backoff strategy} |
| Dead letter queue | {Yes — DLQ name / No} |
| Idempotency handling | {Yes — mechanism / No} |
| Message ordering | {Guaranteed / Best-effort / N/A} |
| Consumer groups | {group names and purpose} |

## 6. Event Flow Diagrams

```mermaid
flowchart LR
    subgraph Producers
        {producer_1}["{Producer 1}"]
        {producer_2}["{Producer 2}"]
    end

    subgraph Messaging
        {topic_1}[("{Topic 1}")]
        {topic_2}[("{Topic 2}")]
    end

    subgraph Consumers
        {consumer_1}["{Consumer 1}"]
        {consumer_2}["{Consumer 2}"]
    end

    {producer_1} --> {topic_1}
    {producer_2} --> {topic_2}
    {topic_1} --> {consumer_1}
    {topic_2} --> {consumer_2}
```

{Add sequence diagrams for 2-3 key event-driven flows.}
