/**
 * Task Manager Component
 * Manages automated follow-ups, task assignment, and task tracking
 */

import { FC, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CheckCircle2,
  Circle,
  Clock,
  User,
  Calendar,
  Plus,
  MoreVertical,
  Bell
} from 'lucide-react';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: number;
  contactId?: string;
  contactName?: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  createdAt: number;
  automatedFollowUp?: boolean;
}

interface TaskManagerProps {
  className?: string;
}

// Demo tasks
const DEMO_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Follow up with Sarah Chen',
    description: 'No response to initial outreach, follow up about climate rally',
    assignee: 'Marcus Johnson',
    contactId: 'contact-1',
    contactName: 'Sarah Chen',
    dueDate: Date.now() + 2 * 24 * 60 * 60 * 1000,
    status: 'pending',
    priority: 'high',
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    automatedFollowUp: true
  },
  {
    id: 'task-2',
    title: 'Schedule 1-on-1 with Emma Rodriguez',
    description: 'Interested in becoming core organizer, schedule coffee meeting',
    assignee: 'Jordan Kim',
    contactId: 'contact-2',
    contactName: 'Emma Rodriguez',
    dueDate: Date.now() + 5 * 24 * 60 * 60 * 1000,
    status: 'in-progress',
    priority: 'medium',
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    automatedFollowUp: false
  },
  {
    id: 'task-3',
    title: 'Send event reminder to Marcus',
    description: 'Remind about organizing workshop this weekend',
    assignee: 'Sarah Chen',
    contactId: 'contact-3',
    contactName: 'Marcus Thompson',
    dueDate: Date.now() + 1 * 24 * 60 * 60 * 1000,
    status: 'pending',
    priority: 'high',
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    automatedFollowUp: false
  },
  {
    id: 'task-4',
    title: 'Check in on Jordan\'s housing situation',
    description: 'Requested temporary housing, see if need is still active',
    assignee: 'Emma Rodriguez',
    contactId: 'contact-4',
    contactName: 'Jordan Lee',
    dueDate: Date.now() + 3 * 24 * 60 * 60 * 1000,
    status: 'pending',
    priority: 'medium',
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    automatedFollowUp: true
  },
  {
    id: 'task-5',
    title: 'Thank donors from last fundraiser',
    description: 'Send personal thank you messages to all contributors',
    assignee: 'Marcus Johnson',
    status: 'completed',
    priority: 'low',
    createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    automatedFollowUp: false
  }
];

export const TaskManager: FC<TaskManagerProps> = ({ className }) => {
  const [tasks, setTasks] = useState<Task[]>(DEMO_TASKS);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed'>('all');

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const handleToggleComplete = (taskId: string) => {
    setTasks(tasks.map(task =>
      task.id === taskId
        ? { ...task, status: task.status === 'completed' ? 'pending' : 'completed' }
        : task
    ));
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(task => task.id !== taskId));
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-blue-500';
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    if (status === 'completed') {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
    return <Circle className="w-5 h-5 text-muted-foreground" />;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Task Queue</h3>
          <p className="text-sm text-muted-foreground">
            {tasks.filter(t => t.status !== 'completed').length} active tasks
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Filter: {filter === 'all' ? 'All' : filter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFilter('all')}>
                All Tasks
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('pending')}>
                Pending
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('in-progress')}>
                In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('completed')}>
                Completed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No tasks found</p>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card key={task.id} className="p-4">
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                  onClick={() => handleToggleComplete(task.id)}
                  className="mt-0.5"
                >
                  {getStatusIcon(task.status)}
                </button>

                {/* Task Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                      {task.automatedFollowUp && (
                        <Bell className="w-3 h-3 inline-block ml-2 text-blue-500" title="Automated follow-up" />
                      )}
                    </h4>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit Task</DropdownMenuItem>
                        <DropdownMenuItem>Reassign</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {task.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {task.description}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    {task.assignee && (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{task.assignee}</span>
                      </div>
                    )}

                    {task.contactName && (
                      <div className="flex items-center gap-1">
                        <span>Contact: {task.contactName}</span>
                      </div>
                    )}

                    {task.dueDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{format(task.dueDate, 'MMM d')}</span>
                      </div>
                    )}

                    <div className={`flex items-center gap-1 ${getPriorityColor(task.priority)}`}>
                      <Clock className="w-3 h-3" />
                      <span className="capitalize">{task.priority} priority</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Automation Info */}
      <Card className="p-4 bg-blue-500/5 border-blue-500/20">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-sm mb-1">Automated Follow-Ups</h4>
            <p className="text-xs text-muted-foreground">
              Tasks marked with <Bell className="w-3 h-3 inline-block text-blue-500" /> are automatically created when contacts don't respond within 3 days.
              You can configure automation rules in settings.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
