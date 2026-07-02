import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RequireAuth } from "./lib/auth";
import Home from "./pages/Home";
import NewTranscription from "./pages/NewTranscription";
import OcrAnalytics from "./pages/OcrAnalytics";
import AdminClients from "./pages/AdminClients";
import Auth from "./pages/Auth";
import PageReview from "./pages/PageReview";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={Auth} />
      <Route path="/" component={() => <RequireAuth><Home /></RequireAuth>} />
      <Route path="/new" component={() => <RequireAuth><NewTranscription /></RequireAuth>} />
      <Route path="/analytics" component={() => <RequireAuth><OcrAnalytics /></RequireAuth>} />
      <Route path="/admin/clients" component={() => <RequireAuth><AdminClients /></RequireAuth>} />
      <Route path="/review/:jobId/:pageId" component={() => <RequireAuth><PageReview /></RequireAuth>} />
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
