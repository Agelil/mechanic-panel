import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Plus, Pencil, Trash2, Save, X, Search, Loader2, FolderOpen, FileText
} from "lucide-react";

interface WikiArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_CATEGORIES = ["Общее", "Регламенты", "Инструкции", "Обучение", "FAQ"];

export default function AdminWikiPage() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage_wiki");

  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<WikiArticle | null>(null);

  // Editor state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", content: "", category: "Общее" });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("wiki_articles")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "Ошибка загрузки", description: error.message, variant: "destructive" });
    } else {
      setArticles(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Unique categories from articles + defaults
  const categories = useMemo(() => {
    const cats = new Set(DEFAULT_CATEGORIES);
    articles.forEach((a) => cats.add(a.category));
    return Array.from(cats).sort();
  }, [articles]);

  // Filtered articles
  const filtered = useMemo(() => {
    let list = articles;
    if (selectedCategory) list = list.filter((a) => a.category === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q));
    }
    return list;
  }, [articles, selectedCategory, search]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    articles.forEach((a) => { map[a.category] = (map[a.category] || 0) + 1; });
    return map;
  }, [articles]);

  const openCreate = () => {
    setEditId(null);
    setEditForm({ title: "", content: "", category: selectedCategory || "Общее" });
    setEditing(true);
    setSelectedArticle(null);
  };

  const openEdit = (article: WikiArticle) => {
    setEditId(article.id);
    setEditForm({ title: article.title, content: article.content, category: article.category });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditId(null);
  };

  const saveArticle = async () => {
    if (!editForm.title.trim()) {
      toast({ title: "Введите заголовок", variant: "destructive" });
      return;
    }
    setSaving(true);

    if (editId) {
      const { error } = await supabase.from("wiki_articles").update({
        title: editForm.title.trim(),
        content: editForm.content,
        category: editForm.category,
      }).eq("id", editId);
      if (error) {
        toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "✓ Статья обновлена" });
        setEditing(false);
        setEditId(null);
        await load();
        // Update selected article view
        setSelectedArticle((prev) => prev?.id === editId ? { ...prev, ...editForm, title: editForm.title.trim() } : prev);
      }
    } else {
      const { data, error } = await supabase.from("wiki_articles").insert([{
        title: editForm.title.trim(),
        content: editForm.content,
        category: editForm.category,
      }]).select().single();
      if (error) {
        toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "✓ Статья создана" });
        setEditing(false);
        await load();
        if (data) setSelectedArticle(data);
      }
    }
    setSaving(false);
  };

  const deleteArticle = async (id: string) => {
    if (!confirm("Удалить статью?")) return;
    const { error } = await supabase.from("wiki_articles").delete().eq("id", id);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      setArticles((p) => p.filter((a) => a.id !== id));
      if (selectedArticle?.id === id) setSelectedArticle(null);
      toast({ title: "Статья удалена" });
    }
  };

  // Simple markdown-like rendering
  const renderContent = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("### ")) return <h3 key={i} className="font-display text-lg tracking-wider mt-4 mb-2">{line.slice(4)}</h3>;
      if (line.startsWith("## ")) return <h2 key={i} className="font-display text-xl tracking-wider mt-5 mb-2">{line.slice(3)}</h2>;
      if (line.startsWith("# ")) return <h1 key={i} className="font-display text-2xl tracking-wider mt-6 mb-3">{line.slice(2)}</h1>;
      if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-6 font-mono text-sm list-disc">{line.slice(2)}</li>;
      if (line.match(/^\d+\.\s/)) return <li key={i} className="ml-6 font-mono text-sm list-decimal">{line.replace(/^\d+\.\s/, "")}</li>;
      if (line.trim() === "") return <br key={i} />;
      return <p key={i} className="font-mono text-sm leading-relaxed mb-1">{line}</p>;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-orange animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl tracking-wider">БАЗА ЗНАНИЙ</h1>
          <p className="font-mono text-sm text-muted-foreground">{articles.length} статей</p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-orange text-primary-foreground px-5 py-2.5 font-mono text-sm hover:bg-orange-bright transition-colors shadow-brutal-sm"
          >
            <Plus className="w-4 h-4" /> Создать статью
          </button>
        )}
      </div>

      <div className="flex gap-6 min-h-[60vh]">
        {/* Left sidebar — categories + article list */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="w-full bg-surface border-2 border-border pl-9 pr-4 py-2.5 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
            />
          </div>

          {/* Categories */}
          <div className="bg-surface border-2 border-border">
            <div className="px-4 py-3 border-b-2 border-border">
              <h3 className="font-display text-sm tracking-widest text-muted-foreground">КАТЕГОРИИ</h3>
            </div>
            <div className="p-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full flex items-center gap-2 px-3 py-2 font-mono text-sm transition-colors ${
                  !selectedCategory ? "bg-orange/10 text-orange border-r-2 border-orange" : "hover:bg-muted/50 text-foreground"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span className="flex-1 text-left">Все</span>
                <span className="text-xs text-muted-foreground">{articles.length}</span>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                  className={`w-full flex items-center gap-2 px-3 py-2 font-mono text-sm transition-colors ${
                    selectedCategory === cat ? "bg-orange/10 text-orange border-r-2 border-orange" : "hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span className="flex-1 text-left truncate">{cat}</span>
                  <span className="text-xs text-muted-foreground">{categoryCounts[cat] || 0}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Article list */}
          <div className="bg-surface border-2 border-border">
            <div className="px-4 py-3 border-b-2 border-border">
              <h3 className="font-display text-sm tracking-widest text-muted-foreground">СТАТЬИ</h3>
            </div>
            <div className="max-h-[45vh] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="p-4 font-mono text-xs text-muted-foreground text-center">Нет статей</p>
              ) : (
                filtered.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { setSelectedArticle(a); setEditing(false); }}
                    className={`w-full text-left px-4 py-3 border-b border-border/50 last:border-0 transition-colors ${
                      selectedArticle?.id === a.id ? "bg-orange/10 border-l-2 border-l-orange" : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-mono text-sm truncate">{a.title}</p>
                        <p className="font-mono text-xs text-muted-foreground">{a.category}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 bg-surface border-2 border-border">
          {editing ? (
            /* Editor */
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl tracking-wider">
                  {editId ? "РЕДАКТИРОВАНИЕ" : "НОВАЯ СТАТЬЯ"}
                </h2>
                <button onClick={cancelEdit} className="p-2 border border-border hover:border-destructive hover:text-destructive transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Заголовок *</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Название статьи"
                    className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                  />
                </div>
                <div>
                  <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Категория</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                  >
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">
                  Содержание (поддерживается # заголовки, - списки)
                </label>
                <textarea
                  value={editForm.content}
                  onChange={(e) => setEditForm((p) => ({ ...p, content: e.target.value }))}
                  rows={18}
                  placeholder="Текст статьи..."
                  className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange transition-colors resize-y"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={saveArticle}
                  disabled={saving}
                  className="flex items-center gap-2 bg-orange text-primary-foreground px-5 py-2.5 font-mono text-sm hover:bg-orange-bright transition-colors disabled:opacity-50 shadow-brutal-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Сохранить
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-2 border-2 border-border px-5 py-2.5 font-mono text-sm hover:border-orange transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : selectedArticle ? (
            /* Article view */
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className="font-mono text-xs text-orange border border-orange/30 px-2 py-0.5 mb-2 inline-block">
                    {selectedArticle.category}
                  </span>
                  <h2 className="font-display text-3xl tracking-wider mt-2">{selectedArticle.title}</h2>
                  <p className="font-mono text-xs text-muted-foreground mt-1">
                    Обновлено: {new Date(selectedArticle.updated_at).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(selectedArticle)}
                      className="flex items-center gap-1.5 border-2 border-border px-3 py-2 font-mono text-xs hover:border-orange hover:text-orange transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Редактировать
                    </button>
                    <button
                      onClick={() => deleteArticle(selectedArticle.id)}
                      className="flex items-center gap-1.5 border-2 border-border px-3 py-2 font-mono text-xs text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Удалить
                    </button>
                  </div>
                )}
              </div>
              <div className="border-t-2 border-border pt-6">
                {renderContent(selectedArticle.content)}
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="flex items-center justify-center h-full min-h-[40vh]">
              <div className="text-center">
                <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="font-mono text-sm text-muted-foreground">Выберите статью из списка</p>
                {canManage && (
                  <button
                    onClick={openCreate}
                    className="mt-4 flex items-center gap-2 mx-auto border-2 border-border px-4 py-2 font-mono text-xs hover:border-orange hover:text-orange transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Создать первую статью
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
