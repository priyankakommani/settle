import { useNavigate } from 'react-router-dom';
import { Button, EmptyState } from '../ui/primitives.js';
import { Icon } from '../ui/icons.js';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{ paddingTop: 'var(--sp-12)' }}>
      <EmptyState
        icon={<Icon.Alert size={20} />}
        title="Page not found"
        action={
          <Button variant="primary" onClick={() => navigate('/')}>
            Go to start
          </Button>
        }
      >
        The page you were looking for doesn't exist or you don't have access to it.
      </EmptyState>
    </div>
  );
}
