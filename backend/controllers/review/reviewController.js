const Review = require('../../schemas/review/Review');

exports.getAllReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, bookId } = req.query;
    const query = {};

    if (req.user?.role === 'Reader') {
      query.status = 'Active';
    }
    if (bookId) query.book = bookId;

    const reviews = await Review.find(query)
      .populate('book', 'title author isbn')
      .populate('member', 'name email')
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(query);

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: reviews
    });
  } catch (error) {
    next(error);
  }
};

exports.getReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('book', 'title author isbn')
      .populate('member', 'name email')
      .populate('user', 'username email');

    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    if (req.user?.role === 'Reader' && review.status !== 'Active') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    res.status(200).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

exports.createReview = async (req, res, next) => {
  try {
    const { bookId, rating, comment } = req.body;
    const memberId = req.user.member;

    const review = await Review.create({
      book: bookId,
      member: memberId,
      user: req.user._id,
      rating,
      comment: comment || '',
      status: 'Active'
    });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

exports.updateReview = async (req, res, next) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    res.status(200).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

