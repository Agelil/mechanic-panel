import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-grid">
      <div className="text-center px-4">
        <div className="font-display text-[12rem] leading-none text-orange/20 select-none">404</div>
        <h1 className="font-display text-5xl tracking-wider mb-4 -mt-8">СТРАНИЦА НЕ НАЙДЕНА</h1>
        <p className="font-mono text-sm text-muted-foreground mb-8">
          Запрашиваемая страница не существует или была перемещена.
        </p>
        <Link to="/" className="inline-flex items-center gap-2 bg-orange text-primary-foreground px-6 py-3 font-display text-xl tracking-widest hover:bg-orange-bright transition-colors shadow-brutal">
          На главную →
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
