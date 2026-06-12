import { Role, useRole } from '../../contexts/RoleContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../ui/utils';

const roles: Role[] = ['Executive', 'Operations', 'Marketing', 'Support'];

const roleLabels: Record<Role, string> = {
  Executive: 'Executive',
  Operations: 'Operations',
  Marketing: 'Marketing',
  Support: 'Support',
};

interface RoleSwitcherProps {
  className?: string;
}

export function RoleSwitcher({ className }: RoleSwitcherProps) {
  const { role, setRole } = useRole();

  return (
    <Select onValueChange={setRole} value={role}>
      <SelectTrigger className={cn('inline-flex items-center bg-muted rounded-lg p-1', className)}>
        <SelectValue placeholder="Select a role" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((item) => (
          <SelectItem key={item} value={item}>
            {roleLabels[item]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
