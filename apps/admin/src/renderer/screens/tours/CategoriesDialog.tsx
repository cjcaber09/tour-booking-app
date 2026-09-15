import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { useAuth } from '../../states/authStore';
import { toast } from '../../toast';
import { cleanIpcErrorMessage } from '../../lib/ipc';
import { useEscapeToClose } from '../../lib/useEscapeToClose';
import { useBackdropDismiss } from '../../lib/useBackdropDismiss';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Button } from '../../components/ui/button';
import type { CategorySummary } from '../../../preload';

interface CategoriesDialogProps {
  onClose: () => void;
}

function sortByName(categories: CategorySummary[]): CategorySummary[] {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name));
}

export function CategoriesDialog({ onClose }: CategoriesDialogProps) {
  const { session } = useAuth();
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<CategorySummary | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!session) {
      return;
    }
    setLoading(true);
    try {
      const result = await window.categoriesAPI.list(1, 100, session.accessToken);
      setCategories(sortByName(result.categories));
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not load categories.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!session || !newName.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      const created = await window.categoriesAPI.create({ name: newName.trim() }, session.accessToken);
      setCategories((prev) => sortByName([...prev, created]));
      setNewName('');
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not create category.');
    } finally {
      setSubmitting(false);
    }
  }

  function startEditing(category: CategorySummary) {
    setEditingId(category.id);
    setEditingName(category.name);
  }

  async function handleRename(id: string) {
    if (!session || !editingName.trim()) {
      return;
    }
    try {
      const updated = await window.categoriesAPI.update(id, { name: editingName.trim() }, session.accessToken);
      setCategories((prev) => sortByName(prev.map((c) => (c.id === id ? updated : c))));
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not rename category.');
    }
  }

  async function handleConfirmDelete() {
    if (!session || !confirmDeleteCategory) {
      return;
    }
    const category = confirmDeleteCategory;
    setConfirmDeleteCategory(null);
    try {
      await window.categoriesAPI.delete(category.id, session.accessToken);
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      toast.success('Category deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not delete category.');
    }
  }

  useEscapeToClose(onClose);
  const backdropRef = useBackdropDismiss(onClose);

  return (
    <div className="dialog-backdrop">
      <div ref={backdropRef} className="dialog-backdrop-dismiss" aria-hidden="true" />
      <div className="dialog-card">
        <h3 className="dialog-title">Categories</h3>

        <form className="mb-4 flex gap-2" onSubmit={handleCreate}>
          <input
            className="neu-field py-2"
            placeholder="New category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={submitting || !newName.trim()}>
            Add
          </Button>
        </form>

        {loading && <p className="status-message">Loading…</p>}
        {!loading && categories.length === 0 && <p className="status-message">No categories yet.</p>}

        <div className="flex max-h-70 flex-col gap-2 overflow-y-auto">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center gap-2 rounded-xl bg-surface p-2 neu-inset-sm">
              {editingId === category.id ? (
                <>
                  <input
                    className="neu-field flex-1 py-1.5"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                  />
                  <Button size="icon" onClick={() => handleRename(category.id)} aria-label="Save name">
                    <Check size={14} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancel rename">
                    <X size={14} />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-heading">{category.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEditing(category)}
                    aria-label={`Rename ${category.name}`}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-error"
                    onClick={() => setConfirmDeleteCategory(category)}
                    aria-label={`Delete ${category.name}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="dialog-actions mt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>

      {confirmDeleteCategory && (
        <ConfirmDialog
          title="Delete category"
          message={`Delete "${confirmDeleteCategory.name}"? Tours tagged with it will just lose this tag — they won't be deleted.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteCategory(null)}
        />
      )}
    </div>
  );
}
