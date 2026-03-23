import { MemoryManager, MemoryEntry } from '../memory/memory-manager';

export interface Subscription {
  id?: number;
  subscriber_agent: string;
  publisher_agent: string;
  event_type: 'decision' | 'finding' | 'pattern' | 'anti-pattern';
  partition_filter?: string;
  enabled: boolean;
}

export class SubscriptionManager {
  private db: MemoryManager;

  constructor(db: MemoryManager) {
    this.db = db;
  }

  async subscribe(sub: Omit<Subscription, 'id'>): Promise<number> {
    const database = this.db.getDatabase();
    database.run(
      `INSERT INTO subscriptions (subscriber_agent, publisher_agent, event_type, partition_filter, enabled)
       VALUES (?, ?, ?, ?, ?)`,
      [sub.subscriber_agent, sub.publisher_agent, sub.event_type, sub.partition_filter || null, sub.enabled ? 1 : 0]
    );
    const result = database.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0] as number;
  }

  async unsubscribe(id: number): Promise<void> {
    const database = this.db.getDatabase();
    database.run('DELETE FROM subscriptions WHERE id = ?', [id]);
  }

  async getSubscriptions(agentId: string): Promise<Subscription[]> {
    const database = this.db.getDatabase();
    const result = database.exec(
      'SELECT * FROM subscriptions WHERE subscriber_agent = ? AND enabled = 1',
      [agentId]
    );
    if (!result.length) return [];
    return result[0].values.map(row => this.rowToSubscription(result[0].columns, row));
  }

  async setupDefaults(): Promise<void> {
    const database = this.db.getDatabase();

    // Check if defaults already exist
    const existing = database.exec('SELECT COUNT(*) FROM subscriptions');
    if (existing.length && (existing[0].values[0][0] as number) > 0) return;

    const devAgents = ['senior-frontend', 'senior-backend', 'senior-fullstack'];
    const eventTypes: Subscription['event_type'][] = ['decision', 'finding', 'pattern', 'anti-pattern'];

    const subscriptions: Omit<Subscription, 'id'>[] = [];

    // Architect (Theo) publishes → notify dev agents, QA, Security, Test Architect
    for (const subscriber of [...devAgents, 'qa', 'security', 'test-architect']) {
      for (const eventType of eventTypes) {
        subscriptions.push({
          subscriber_agent: subscriber,
          publisher_agent: 'architect',
          event_type: eventType,
          enabled: true,
        });
      }
    }

    // Security (Zara) publishes → notify dev agents, Architect, DevOps
    for (const subscriber of [...devAgents, 'architect', 'devops']) {
      for (const eventType of eventTypes) {
        subscriptions.push({
          subscriber_agent: subscriber,
          publisher_agent: 'security',
          event_type: eventType,
          enabled: true,
        });
      }
    }

    // QA (Vera) publishes findings → notify dev agents, Architect
    for (const subscriber of [...devAgents, 'architect']) {
      subscriptions.push({
        subscriber_agent: subscriber,
        publisher_agent: 'qa',
        event_type: 'finding',
        enabled: true,
      });
    }

    // DevOps (Soren) publishes → notify Architect, dev agents
    for (const subscriber of ['architect', ...devAgents]) {
      for (const eventType of eventTypes) {
        subscriptions.push({
          subscriber_agent: subscriber,
          publisher_agent: 'devops',
          event_type: eventType,
          enabled: true,
        });
      }
    }

    // Test Architect (Sable) publishes → notify QA, dev agents
    for (const subscriber of ['qa', ...devAgents]) {
      for (const eventType of eventTypes) {
        subscriptions.push({
          subscriber_agent: subscriber,
          publisher_agent: 'test-architect',
          event_type: eventType,
          enabled: true,
        });
      }
    }

    // PM (Derek) publishes → notify Architect, Scrum Master
    for (const subscriber of ['architect', 'sm']) {
      for (const eventType of eventTypes) {
        subscriptions.push({
          subscriber_agent: subscriber,
          publisher_agent: 'pm',
          event_type: eventType,
          enabled: true,
        });
      }
    }

    for (const sub of subscriptions) {
      await this.subscribe(sub);
    }
  }

  async notifySubscribers(publisherAgent: string, entryId: number, eventType: string): Promise<number> {
    const database = this.db.getDatabase();
    const result = database.exec(
      `SELECT * FROM subscriptions WHERE publisher_agent = ? AND event_type = ? AND enabled = 1`,
      [publisherAgent, eventType]
    );

    if (!result.length) return 0;

    let count = 0;
    for (const row of result[0].values) {
      const sub = this.rowToSubscription(result[0].columns, row);

      database.run(
        `INSERT INTO notifications (subscription_id, entry_id, recipient_agent)
         VALUES (?, ?, ?)`,
        [sub.id, entryId, sub.subscriber_agent]
      );
      count++;
    }

    return count;
  }

  async getUnreadNotifications(agentId: string): Promise<{
    entry: MemoryEntry;
    notification_id: number;
    publisher_agent: string;
  }[]> {
    const database = this.db.getDatabase();
    const result = database.exec(
      `SELECT n.id as notification_id, n.entry_id, s.publisher_agent
       FROM notifications n
       JOIN subscriptions s ON n.subscription_id = s.id
       WHERE n.recipient_agent = ? AND n.read = 0
       ORDER BY n.created_at DESC`,
      [agentId]
    );

    if (!result.length) return [];

    const notifications: { entry: MemoryEntry; notification_id: number; publisher_agent: string }[] = [];

    for (const row of result[0].values) {
      const notificationId = row[0] as number;
      const entryId = row[1] as number;
      const publisherAgent = row[2] as string;

      const entry = await this.db.get(entryId);
      if (entry) {
        notifications.push({
          entry,
          notification_id: notificationId,
          publisher_agent: publisherAgent,
        });
      }
    }

    return notifications;
  }

  async markRead(notificationIds: number[]): Promise<void> {
    if (notificationIds.length === 0) return;
    const database = this.db.getDatabase();
    const placeholders = notificationIds.map(() => '?').join(', ');
    database.run(
      `UPDATE notifications SET read = 1 WHERE id IN (${placeholders})`,
      notificationIds
    );
  }

  async formatNotificationsForPrompt(agentId: string): Promise<string> {
    const notifications = await this.getUnreadNotifications(agentId);
    if (notifications.length === 0) return '';

    // Group by publisher agent
    const grouped = new Map<string, typeof notifications>();
    for (const n of notifications) {
      if (!grouped.has(n.publisher_agent)) grouped.set(n.publisher_agent, []);
      grouped.get(n.publisher_agent)!.push(n);
    }

    const agentNames: Record<string, string> = {
      'architect': 'Theo (Architect)',
      'security': 'Zara (Security)',
      'qa': 'Vera (QA)',
      'devops': 'Soren (DevOps)',
      'test-architect': 'Sable (Test Architect)',
      'pm': 'Derek (PM)',
      'sm': 'Nate (Scrum Master)',
      'senior-frontend': 'Avery (Frontend)',
      'senior-backend': 'Rowan (Backend)',
      'senior-fullstack': 'Jordan (Fullstack)',
    };

    let output = '## Recent Updates From Other Agents\n\n';

    for (const [agent, items] of grouped) {
      const agentLabel = agentNames[agent] || agent;
      const partitionCounts = new Map<string, number>();
      for (const item of items) {
        const p = item.entry.partition;
        partitionCounts.set(p, (partitionCounts.get(p) || 0) + 1);
      }
      const summary = [...partitionCounts.entries()].map(([p, c]) => `${c} new ${p}`).join(', ');

      output += `### From ${agentLabel} — ${summary}\n`;
      for (let i = 0; i < items.length; i++) {
        output += `${i + 1}. **${items[i].entry.title}** — ${items[i].entry.content.split('\n')[0]}\n`;
      }
      output += '\n';
    }

    return output;
  }

  private rowToSubscription(columns: string[], row: unknown[]): Subscription {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return {
      id: obj.id as number,
      subscriber_agent: obj.subscriber_agent as string,
      publisher_agent: obj.publisher_agent as string,
      event_type: obj.event_type as Subscription['event_type'],
      partition_filter: obj.partition_filter as string | undefined,
      enabled: (obj.enabled as number) === 1,
    };
  }
}
