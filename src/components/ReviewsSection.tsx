import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

interface Review {
  id: string;
  client_name: string | null;
  rating: number;
  feedback: string | null;
  created_at: string;
}

export function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    supabase
      .from("reviews")
      .select("id, client_name, rating, feedback, created_at")
      .eq("is_published", true)
      .gte("rating", 4)
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => setReviews(data || []));
  }, []);

  if (reviews.length === 0) return null;

  return (
    <section className="py-20 border-y-2 border-border bg-surface">
      <div className="container mx-auto px-4">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <span className="font-mono text-xs text-orange uppercase tracking-widest">// Наши клиенты</span>
            <h2 className="font-display text-5xl md:text-6xl tracking-wider mt-2">
              ОТЗЫВЫ О <span className="text-orange">РАБОТЕ</span>
            </h2>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-5 h-5 text-orange fill-orange" />
              ))}
            </div>
            <span className="font-mono text-sm text-muted-foreground ml-2">{reviews.length} отзывов</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
          {reviews.map((review) => (
            <div key={review.id} className="bg-background p-6 hover:bg-surface transition-colors">
              <div className="flex items-center gap-0.5 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${review.rating >= s ? "text-orange fill-orange" : "text-muted-foreground"}`}
                  />
                ))}
              </div>
              {review.feedback && (
                <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-4">
                  «{review.feedback}»
                </p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange/10 border border-orange/20 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-orange" />
                  </div>
                  <span className="font-mono text-sm font-bold">{review.client_name || "Клиент"}</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/booking"
            className="inline-flex items-center gap-2 font-mono text-sm text-orange border border-orange px-6 py-3 hover:bg-orange hover:text-primary-foreground transition-colors"
          >
            Записаться на сервис →
          </Link>
        </div>
      </div>
    </section>
  );
}
