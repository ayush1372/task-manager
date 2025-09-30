import { authService } from "../services/authService.js";

export const authController = {
  register: async (req, res) => {
    try {
      const { name, email, password,role } = req.body;
      const user = await authService.register({ name, email, password,role });
      res.status(201).json({ message: "User registered", user });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      const { accessToken, refreshToken, user } = await authService.login({
        email,
        password,
      });
      res.status(200).json({ accessToken, refreshToken, user });
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  },

  refresh: async (req, res) => {
    try {
         const { refreshToken } = req.body;
         const {accessToken} = await authService.refresh({refreshToken});
         res.status(200).json({accessToken});
        
    } catch (err) {
        res.status(403).json({ error: err.message });  
    } 
  },
  logout: async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    await authService.logout({ refreshToken });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
},

};
