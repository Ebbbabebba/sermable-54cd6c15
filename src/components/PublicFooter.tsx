import { Link } from "react-router-dom";

export const PublicFooter = () => {
  return (
    <footer className="py-4 px-6 text-center text-xs text-muted-foreground space-x-3">
      <Link to="/terms" className="hover:underline">Terms</Link>
      <Link to="/privacy" className="hover:underline">Privacy</Link>
      <Link to="/refund-policy" className="hover:underline">Refund Policy</Link>
    </footer>
  );
};
