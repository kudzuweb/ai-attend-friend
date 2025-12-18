interface WidgetTaskListProps {
  tasks: SessionTask[];
}

export default function WidgetTaskList({ tasks }: WidgetTaskListProps) {
  if (tasks.length === 0) {
    return null;
  }

  async function handleToggle(taskId: string) {
    await window.api.toggleTaskComplete(taskId);
  }

  return (
    <div className="widget-task-list">
      <div className="task-list-header">Tasks</div>
      <ul className="task-items">
        {tasks.map((task) => (
          <li key={task.id} className="task-item">
            <div className="task-row">
              <input
                type="checkbox"
                checked={task.isCompleted}
                onChange={() => handleToggle(task.id)}
                className="task-checkbox"
              />
              <span className={`task-content ${task.isCompleted ? 'completed' : ''}`}>
                {task.content}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
