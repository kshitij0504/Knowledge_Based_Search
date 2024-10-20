import React, { useState } from "react";
import { ThemeProvider, createTheme, useTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  Tab,
  Tabs,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Paper,
  Fade,
  Stack,
} from '@mui/material';
import SearchIcon from "@mui/icons-material/Search";
import EmailIcon from "@mui/icons-material/Email";

import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import Lottie from "react-lottie-player";
import axios from "axios";
import { useMediaQuery } from "@mui/material";
import searchAnimation from "./animations/Animation - 1729458077452.json";
import { Snackbar, Alert } from '@mui/material';

const getTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: mode === "dark" ? "#2196f3" : "#1976d2",
      },
      secondary: {
        main: mode === "dark" ? "#f50057" : "#dc004e",
      },
      background: {
        default: mode === "dark" ? "#121212" : "#f5f5f5",
        paper: mode === "dark" ? "#1e1e1e" : "#ffffff",
      },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            transition: "transform 0.2s ease-in-out",
            "&:hover": {
              transform: "translateY(-4px)",
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: "none",
          },
        },
      },
      breakpoints: {
        values: {
          xs: 0,
          sm: 600,
          md: 900,
          lg: 1200,
          xl: 1536,
        },
      },
    },
  });

function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ stackoverflow: [], reddit: [] });
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [sortBy, setSortBy] = useState("relevance");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [themeMode, setThemeMode] = useState("dark");
  const [notification, setNotification] = useState({
    open: false,
    type: "success",
    message: "",
  });

  const theme = React.useMemo(() => getTheme(themeMode), [themeMode]);
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const showNotification = (type, message) => {
    setNotification({ open: true, type, message });
    setTimeout(() => setNotification({ ...notification, open: false }), 3000);
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      showNotification("error", "Please enter a search query");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post("https://knowledge-based-search.onrender.com/api/search", {
        query: query.trim(),
      });

      if (response.data) {
        const sortedResults = {
          stackoverflow: sortResults(response.data.stackoverflow, sortBy),
          reddit: sortResults(response.data.reddit, sortBy),
        };
        setResults(sortedResults);
        showNotification("success", "Search completed successfully!");
      }
    } catch (error) {
      console.error("Search error:", error);
      showNotification("error", error.response?.data?.error || "Error fetching results");
    } finally {
      setLoading(false);
    }
  };

  const sortResults = (items, sortType) => {
    if (!items) return [];

    const sortedItems = [...items];
    switch (sortType) {
      case "date":
        return sortedItems.sort((a, b) => {
          const dateA = a.creation_date || a.data?.created_utc || 0;
          const dateB = b.creation_date || b.data?.created_utc || 0;
          return dateB - dateA;
        });
      case "votes":
        return sortedItems.sort((a, b) => {
          const scoreA = a.score || a.data?.score || 0;
          const scoreB = b.score || b.data?.score || 0;
          return scoreB - scoreA;
        });
      default: // relevance - keep original order
        return sortedItems;
    }
  };

  const handleEmailShare = async () => {
    if (!email.trim() || !results) {
      showNotification("error", "Please enter a valid email address");
      return;
    }

    setEmailSending(true);
    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Invalid email format");
      }

      await axios.post("https://knowledge-based-search.onrender.com/api/email-results", {
        email,
        results,
        query,
      });

      setEmailDialogOpen(false);
      showNotification("success", "Results sent successfully!");
    } catch (error) {
      showNotification("error", error.response?.data?.error || "Failed to send email");
    } finally {
      setEmailSending(false);
    }
  };

  const renderResults = () => {
    const currentResults = tabValue === 0 ? results.stackoverflow : results.reddit;

    if (!currentResults || currentResults.length === 0) {
      return (
        <Typography variant="body1" sx={{ textAlign: "center", py: 4 }}>
          No results found. Try a different search query.
        </Typography>
      );
    }

    return currentResults.map((item, index) => (
      <Card key={index} sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" component="div">
            {tabValue === 0 ? item.title : item.data.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Score: {tabValue === 0 ? item.score : item.data.score}
          </Typography>
          <Typography variant="body1" sx={{ mt: 2 }}>
            {tabValue === 0 ? (
              <div
                dangerouslySetInnerHTML={{
                  __html: item.body?.substring(0, 200) + "...",
                }}
              />
            ) : (
              item.data.selftext?.substring(0, 200) + "..."
            )}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            sx={{ mt: 2 }}
            href={tabValue === 0 ? item.link : `https://reddit.com${item.data.permalink}`}
            target="_blank"
          >
            Read More
          </Button>
        </CardContent>
      </Card>
    ));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
        <Box sx={{ py: { xs: 2, sm: 3, md: 4 } }}>
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: { xs: 2, sm: 0 },
              mb: { xs: 3, sm: 4 }
            }}
          >
            <Typography
              variant={isMobile ? "h4" : "h3"}
              component="h1"
              sx={{
                fontWeight: 'bold',
                fontSize: {
                  xs: '1.75rem',
                  sm: '2.5rem',
                  md: '3rem'
                }
              }}
            >
              Knowledge Base Search
            </Typography>
            <Tooltip title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}>
              <IconButton onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}>
                {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
          </Box>

          <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mb: 4, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <TextField
                variant="outlined"
                placeholder="Search..."
                fullWidth
                size="small"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                sx={{ mr: 1 }}
              />
              <Button variant="contained" onClick={handleSearch} disabled={loading}>
                {loading ? "Searching..." : <SearchIcon />}
              </Button>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <MenuItem value="relevance">Relevance</MenuItem>
                  <MenuItem value="date">Date</MenuItem>
                  <MenuItem value="votes">Votes</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                onClick={() => setEmailDialogOpen(true)}
                startIcon={<EmailIcon />}
                disabled={loading}
              >
                Share Results
              </Button>
            </Box>
          </Paper>

          {/* Results Section */}
          <Tabs
            value={tabValue}
            onChange={(e, newValue) => setTabValue(newValue)}
            sx={{ mb: 2 }}
          >
            <Tab label="Stack Overflow" />
            <Tab label="Reddit" />
          </Tabs>
          <Box>{loading ? <Lottie loop animationData={searchAnimation} play /> : renderResults()}</Box>
        </Box>
      </Container>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)}>
        <DialogTitle>Share Results via Email</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email Address"
            type="email"
            fullWidth
            variant="outlined"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEmailShare} disabled={emailSending}>
            {emailSending ? "Sending..." : "Send"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar open={notification.open} autoHideDuration={3000} onClose={() => setNotification({ ...notification, open: false })}>
        <Alert onClose={() => setNotification({ ...notification, open: false })} severity={notification.type}>
          {notification.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default App;
