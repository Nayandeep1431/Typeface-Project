const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ success: true, data: [] });
});

router.post('/', (req, res) => {
  res.json({ success: true, data: { id: Date.now(), ...req.body } });
});

module.exports = router;
