import "server-only";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

export function createNotificationEmailTemplate(
  type: string,
  actor: { name: string },
  task: { number: number; title: string },
  taskUrl: string
): { html: string; text: string; subject: string } {
  const taskLink = `${APP_URL}${taskUrl}`;

  const templates: Record<string, { subject: string; text: string; html: string }> = {
    "task.created": {
      subject: `Task created: ${task.number}`,
      text: `${actor.name} created a task: ${task.number} - ${task.title}\n\nView task: ${taskLink}`,
      html: `<p><strong>${actor.name}</strong> created a task: <strong>${task.number}</strong> - ${task.title}</p><p><a href="${taskLink}">View task</a></p>`,
    },
    "task.assigned": {
      subject: `Task assigned to you: ${task.number}`,
      text: `${actor.name} assigned you to task ${task.number} - ${task.title}\n\nView task: ${taskLink}`,
      html: `<p><strong>${actor.name}</strong> assigned you to task <strong>${task.number}</strong> - ${task.title}</p><p><a href="${taskLink}">View task</a></p>`,
    },
    "task.unassigned": {
      subject: `Task unassigned: ${task.number}`,
      text: `${actor.name} unassigned you from task ${task.number} - ${task.title}\n\nView task: ${taskLink}`,
      html: `<p><strong>${actor.name}</strong> unassigned you from task <strong>${task.number}</strong> - ${task.title}</p><p><a href="${taskLink}">View task</a></p>`,
    },
    "comment.added": {
      subject: `New comment on task: ${task.number}`,
      text: `${actor.name} commented on task ${task.number} - ${task.title}\n\nView task: ${taskLink}`,
      html: `<p><strong>${actor.name}</strong> commented on task <strong>${task.number}</strong> - ${task.title}</p><p><a href="${taskLink}">View task</a></p>`,
    },
    "due_date_changed": {
      subject: `Due date changed on task: ${task.number}`,
      text: `${actor.name} changed the due date on task ${task.number} - ${task.title}\n\nView task: ${taskLink}`,
      html: `<p><strong>${actor.name}</strong> changed the due date on task <strong>${task.number}</strong> - ${task.title}</p><p><a href="${taskLink}">View task</a></p>`,
    },
    "task.moved": {
      subject: `Task status changed: ${task.number}`,
      text: `${actor.name} moved task ${task.number} - ${task.title}\n\nView task: ${taskLink}`,
      html: `<p><strong>${actor.name}</strong> moved task <strong>${task.number}</strong> - ${task.title}</p><p><a href="${taskLink}">View task</a></p>`,
    },
  };

  const template = templates[type] || templates["task.created"];
  return { html: template.html, text: template.text, subject: template.subject };
}
