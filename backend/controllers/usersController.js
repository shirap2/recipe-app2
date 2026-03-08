const User = require('../models/User');

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('_id username email');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ id: user._id, username: user.username, email: user.email });
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
