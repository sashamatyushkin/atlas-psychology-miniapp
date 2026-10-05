import { Quote, Star } from 'lucide-react';
import { findCourse } from '../domain/catalog';
import type { Review } from '../domain/types';

const GRADIENTS = [
  'linear-gradient(140deg, #e6c49a, #b07a3c)',
  'linear-gradient(140deg, #9fd8cf, #2b7c75)',
  'linear-gradient(140deg, #c7b6ef, #6b55b5)',
  'linear-gradient(140deg, #f2b8a2, #c4513f)',
];

export function ReviewCard({ review, showCourse = true }: { review: Review; showCourse?: boolean }) {
  const initials = review.name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  const gradient = GRADIENTS[Number(review.id.replace(/\D/g, '')) % GRADIENTS.length];
  return (
    <article className="review card">
      <Quote size={22} className="review-quote" />
      <p className="review-text">{review.text}</p>
      <div className="review-result">{review.result}</div>
      <footer className="review-foot">
        <span className="review-avatar" style={{ background: gradient }}>
          {initials}
        </span>
        <div className="review-who">
          <b>{review.name}</b>
          <span>{showCourse ? findCourse(review.courseId)?.title : review.meta}</span>
        </div>
        <span className="review-stars" aria-label={`Оценка ${review.rating} из 5`}>
          {Array.from({ length: review.rating }, (_, i) => (
            <Star key={i} size={11} fill="currentColor" />
          ))}
        </span>
      </footer>
    </article>
  );
}
