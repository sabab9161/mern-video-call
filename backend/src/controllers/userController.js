const serializeProfileUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  mobile: user.mobile || "",
  avatar: user.avatar || ""
});

export const getProfile = (req, res) => {
  res.json({
    user: serializeProfileUser(req.user)
  });
};

export const updateProfile = async (req, res) => {
  const name = req.body.name?.trim();

  if (!name || name.length < 2) {
    return res.status(400).json({ message: "Name must be at least 2 characters" });
  }

  try {
    req.user.name = name;
    if (req.file) {
      req.user.avatar = `/uploads/${req.file.filename}`;
    }
    await req.user.save();

    res.json({
      user: serializeProfileUser(req.user)
    });
  } catch (error) {
    console.error("Profile update failed", error);
    res.status(500).json({ message: "Unable to update profile" });
  }
};
