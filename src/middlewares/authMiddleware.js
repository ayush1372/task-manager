import jwt from "jsonwebtoken";
import { jwtConfig } from "../config/jwt.js";

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  jwt.verify(token, jwtConfig.accessSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
};


export const authorize =(roles = [])=>{
    return (req,res,next)=>{
        if(!roles.includes(req.user.role)){
            return res.status(403).json({error:"Forbidden: You don't have enough permissions"});
        }
        next();
    };
};