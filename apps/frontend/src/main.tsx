import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Web3Provider } from "./components/web3/Web3Provider";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // Enable refetch on window focus
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: Infinity, // Never garbage collect cached data
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Web3Provider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </Web3Provider>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>
);
