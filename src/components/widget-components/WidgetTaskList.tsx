interface WidgetTaskListProps {
  tasks: string[];
}

export default function WidgetTaskList({ tasks }: WidgetTaskListProps) {
  const nonEmptyTasks = tasks.filter(t => t);

  if (nonEmptyTasks.length === 0) {
    return null;
  }

  return (
    <div className="widget-task-list">
      <div className="task-list-header">Tasks</div>
      <ul className="task-items">
        {nonEmptyTasks.map((task, index) => (
          <li key={index} className="task-item">
            <span className="task-content">{task}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
