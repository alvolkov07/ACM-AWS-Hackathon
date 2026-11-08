"""Trust / reputation scoring for suppliers."""

import math
import statistics


def trust_score(c):
    """0-5 score from rating (Bayesian-adjusted), review volume, rating consistency, profile completeness."""
    rating = float(c.get("rating") or 0)
    n = int(c.get("review_count") or 0)
    
    adjusted = (
        (rating * n + 3.8 * 30) / (n + 30) if n else 3.0 * 0.6
    )
    
    volume = min(math.log10(n + 1) / math.log10(501), 1) * 5  # ~500 reviews saturates
    sample = [r["rating"] for r in c.get("reviews", []) if r.get("rating")]
    
    consistency = (
        max(0.0, 5 - statistics.pstdev(sample) * 1.25) if len(sample) >= 2 else adjusted
    )
    
    profile = (
        (2 if c.get("website") else 0)
        + (1.5 if c.get("phone") else 0)
        + (1.5 if c.get("hours") else 0)
    )
    score = adjusted * 0.55 + volume * 0.20 + consistency * 0.10 + profile * 0.15
    
    return round(min(score, 5.0), 2)


def trust_label(score):
    return (
        "Excellent"
        if score >= 4.3
        else "Good"
        if score >= 3.8
        else "Fair"
        if score >= 3.2
        else "Limited data"
    )
