export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Task Manager</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Internal Jira-style task management system
        </p>
      </div>
    </div>
  );
}
