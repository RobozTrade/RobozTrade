import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Trash2, Power } from 'lucide-react';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [showAddKey, setShowAddKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [label, setLabel] = useState('');

  const { data: apiKeys, refetch } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => api.getApiKeys(),
  });

  const createMutation = useMutation({
    mutationFn: () => api.createApiKey({ apiKey, apiSecret, label }),
    onSuccess: () => {
      refetch();
      setShowAddKey(false);
      setApiKey('');
      setApiSecret('');
      setLabel('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteApiKey(id),
    onSuccess: () => refetch(),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.toggleApiKey(id),
    onSuccess: () => refetch(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">
          Manage your API keys and preferences
        </p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-text-primary">API Keys</h3>
          <button
            onClick={() => setShowAddKey(!showAddKey)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add API Key
          </button>
        </div>

        {showAddKey && (
          <div className="bg-background-tertiary p-4 rounded-lg mb-6 space-y-4">
            <div>
              <label className="label">Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="input"
                placeholder="My Aster API Key"
              />
            </div>
            <div>
              <label className="label">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="input"
                placeholder="Enter your API key"
              />
            </div>
            <div>
              <label className="label">API Secret</label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="input"
                placeholder="Enter your API secret"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddKey(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="btn btn-primary flex-1"
              >
                {createMutation.isPending ? 'Adding...' : 'Add Key'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {apiKeys?.data?.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-4 bg-background-tertiary rounded-lg"
            >
              <div>
                <p className="font-medium text-text-primary">{key.label}</p>
                <p className="text-sm text-text-secondary">
                  Added {new Date(key.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleMutation.mutate(key.id)}
                  className={`btn ${
                    key.isActive ? 'btn-success' : 'btn-secondary'
                  } flex items-center gap-2`}
                >
                  <Power className="w-4 h-4" />
                  {key.isActive ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(key.id)}
                  className="btn btn-danger flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
          {(!apiKeys?.data || apiKeys.data.length === 0) && (
            <p className="text-text-secondary text-center py-8">
              No API keys configured. Add one to get started.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

