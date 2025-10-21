import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';

export default function BenchmarksPage() {
  const { data: benchmarks } = useQuery({
    queryKey: ['benchmarks'],
    queryFn: () => api.getBenchmarks(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Benchmarks</h1>
          <p className="text-text-secondary mt-1">
            Test your strategies against market scenarios
          </p>
        </div>
        <button className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Benchmark
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {benchmarks?.data?.map((benchmark) => (
          <div key={benchmark.id} className="card">
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              {benchmark.name}
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              {benchmark.scenarioType.replace('_', ' ').toUpperCase()}
            </p>
            {benchmark.score !== null && (
              <div className="text-2xl font-bold text-primary">
                Score: {benchmark.score}
              </div>
            )}
          </div>
        ))}
      </div>

      {(!benchmarks?.data || benchmarks.data.length === 0) && (
        <div className="card text-center py-12">
          <p className="text-text-secondary mb-4">
            No benchmarks yet. Create your first benchmark test!
          </p>
          <button className="btn btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Benchmark
          </button>
        </div>
      )}
    </div>
  );
}

