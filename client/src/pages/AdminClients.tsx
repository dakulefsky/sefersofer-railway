import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";

interface Client {
  id: string;
  name: string;
  email?: string;
  createdAt?: string;
  jobCount?: number;
}

function DeleteConfirmDialog({
  client,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  client: Client;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  const [confirmText, setConfirmText] = useState("");
  const canDelete = confirmText === client.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-md w-full mx-4 border border-stone-200">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl">⚠️</span>
          <div>
            <h2 className="text-lg font-bold text-stone-800">Delete client?</h2>
            <p className="text-sm text-stone-500 mt-1">
              This will archive <strong>{client.name}</strong> and all associated jobs,
              pages, and corrections. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
          <p className="text-xs text-amber-800">
            Type <strong>{client.name}</strong> to confirm deletion:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={client.name}
            className="mt-2 w-full px-3 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            autoFocus
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canDelete || isDeleting}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <span className="animate-spin">⏳</span> Deleting…
              </>
            ) : (
              "Delete client"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminClients() {
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const { toast, showToast, clearToast } = useToast();

  // TODO: Wire admin.listClients and admin.deleteClient queries once admin router is implemented
  const clients = { data: [], isLoading: false };
  const deleteClient = {
    mutate: () => {},
    isPending: false,
  };

  function handleDeleteConfirm() {
    if (!deletingClient) return;
    deleteClient.mutate();
  }

  const isLoading = clients.isLoading;
  const clientList: Client[] = clients.data ?? [];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={clearToast}
        />
      )}

      {/* Delete dialog */}
      {deletingClient && (
        <DeleteConfirmDialog
          client={deletingClient}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingClient(null)}
          isDeleting={deleteClient.isPending}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-6 py-5">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-stone-800 tracking-tight">Client Management</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Manage clients, their jobs, and access.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-2">
              <div className="text-3xl animate-pulse">📋</div>
              <p className="text-stone-400 text-sm">Loading clients…</p>
            </div>
          </div>
        ) : clientList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <span className="text-4xl">🏛️</span>
            <p className="font-semibold text-stone-600">No clients yet</p>
            <p className="text-sm text-stone-400">
              Clients will appear here once they're added to the system.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <th className="text-left px-5 py-3 font-semibold text-stone-500 uppercase text-xs tracking-wide">
                    Client
                  </th>
                  <th className="text-left px-5 py-3 font-semibold text-stone-500 uppercase text-xs tracking-wide">
                    Jobs
                  </th>
                  <th className="text-left px-5 py-3 font-semibold text-stone-500 uppercase text-xs tracking-wide">
                    Created
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {clientList.map((client) => (
                  <tr key={client.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-stone-800">{client.name}</div>
                      {client.email && (
                        <div className="text-xs text-stone-400 mt-0.5">{client.email}</div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-stone-500">
                      {client.jobCount ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-stone-400 text-xs">
                      {client.createdAt
                        ? new Date(client.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setDeletingClient(client)}
                        className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
