import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How coffee is graded",
  description: "What a cupping score means, what makes coffee specialty grade, and how we place each coffee from clean to funky.",
};

export default function GradingPage() {
  return (
    <div className="wrap narrow">
      <div className="page-head">
        <h1>How coffee is graded</h1>
        <p className="lede">Every coffee we sell is specialty grade. Here&apos;s what the score on each bag means, and why a few points make a big difference.</p>
      </div>
      <div className="prose">
        <h2>The cupping score</h2>
        <p>
          Before a lot is sold, trained tasters (licensed Q graders) &ldquo;cup&rdquo; it: they brew it the same standard way, then score its fragrance and aroma,
          flavor, aftertaste, acidity, body, balance, sweetness, consistency from cup to cup, and whether it tastes clean. The green beans are also checked by
          hand for defects. It all adds up to a score out of 100.
        </p>
        <table className="grading-table">
          <thead>
            <tr>
              <th>Score</th>
              <th>Grade</th>
              <th>What it means</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Below 80</td>
              <td>Commercial</td>
              <td>Most of the world&apos;s coffee. Fine for a can on the supermarket shelf, but not specialty.</td>
            </tr>
            <tr>
              <td>80 to 84.99</td>
              <td>Very good</td>
              <td>Specialty grade: clean, sweet and distinct, from a known origin.</td>
            </tr>
            <tr>
              <td>85 to 89.99</td>
              <td>Excellent</td>
              <td>The top tier of specialty. Small, carefully processed lots with vivid, layered flavor.</td>
            </tr>
            <tr>
              <td>90 and up</td>
              <td>Outstanding</td>
              <td>Rare, competition-level coffee. Very little is produced each year.</td>
            </tr>
          </tbody>
        </table>
        <p>
          The scale isn&apos;t linear: going from 85 to 88 is a much bigger jump in quality, and rarity, than going from 80 to 83. The score we show is the
          cupping score our importer gave that exact lot.
        </p>

        <h2>Defects and grades</h2>
        <p>
          To count as specialty grade, a 350 g sample of green coffee can have no serious (primary) defects and no more than 5 full defects in total, things
          like broken, insect-damaged or underripe beans. That&apos;s what &ldquo;under 5 defects&rdquo; on a lot means. Ethiopia also grades its exports by
          defect count, from Grade 1 (the cleanest) down; Grades 1 and 2 are the ones used for specialty coffee.
        </p>

        <h2>Clean or funky?</h2>
        <p>
          The second bar on each coffee shows its style, which mostly comes from how the fruit was processed after picking:
        </p>
        <ul>
          <li>
            <strong>Washed</strong> coffees have the fruit removed before drying. They taste <em>clean</em>: crisp, bright and tea-like.
          </li>
          <li>
            <strong>Natural</strong> coffees dry inside the whole cherry, so they pick up more fruit and sweetness.
          </li>
          <li>
            <strong>Anaerobic</strong> coffees ferment in sealed tanks before drying. They&apos;re the <em>funkiest</em>: wild, winey and unlike anything else.
          </li>
        </ul>
        <p>Neither end is better. It&apos;s about what you like in the cup.</p>

        <h2>Read more</h2>
        <p>
          The Specialty Coffee Association sets the cupping standards used across the industry. See their{" "}
          <a href="https://sca.coffee/value-assessment" target="_blank" rel="noopener noreferrer">
            Coffee Value Assessment
          </a>{" "}
          for the details.
        </p>
        <p>
          <Link href="/shop">Back to the coffees</Link>
        </p>
      </div>
    </div>
  );
}
