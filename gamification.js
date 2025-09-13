const express = require('express');
const router = express.Router();

router.get('/user-stats', (req, res) => {
  res.json({ 
    success: true, 
    data: { 
      totalPoints: 0, 
      level: 1, 
      earnedBadges: [],
      achievements: []
    } 
  });
});

module.exports = router;
