interface WidgetTaskListProps {
  tasks: [string, string, string];
}

export default function WidgetTaskList({ tasks }: WidgetTaskListProps) {
  return (
    <div className="widget-task-list">
      <div className="task-list-header">Tasks</div>
      <ul className="task-items">
        {tasks.map((task, index) => (
          <li key={index} className="task-item">
            {task ? (
              <span className="task-content">{task}</span>
            ) : (
              <span className="task-empty">-</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
