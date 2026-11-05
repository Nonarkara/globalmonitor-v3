import React, { useState } from 'react';
import paper from '../data/researchPaper.json';
import '../styles/research.css';

const ResearchView = () => {
    const [copied, setCopied] = useState(false);
    const [showBib, setShowBib] = useState(false);

    const copyCitation = async () => {
        try {
            await navigator.clipboard.writeText(paper.bibtex);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            setShowBib(true);
        }
    };

    return (
        <article className="research-view" aria-label="Research preprint">
            <aside className="research-rail">
                <p className="research-eyebrow">Preprint · {paper.version} · {paper.dateLabel}</p>
                <h2 className="research-title">{paper.title}</h2>
                <p className="research-authors">{paper.authors.join(' · ')}</p>
                <p className="research-lead">{paper.lead}</p>
                <div className="research-actions">
                    <a className="research-btn research-btn--primary" href={paper.pdf} download>Download PDF</a>
                    <a className="research-btn" href={paper.pdf} target="_blank" rel="noreferrer">Open full page</a>
                    <button type="button" className="research-btn" onClick={copyCitation}>{copied ? 'Copied' : 'Copy BibTeX'}</button>
                </div>
                {showBib && (
                    <textarea className="research-bib" readOnly rows={7} value={paper.bibtex} aria-label="BibTeX entry" onFocus={(e) => e.target.select()} autoFocus />
                )}
                <p className="research-meta">
                    {paper.pages} pages · {paper.figures} figures · {paper.references} references · {paper.licence} ·{' '}
                    <a href={paper.codeUrl} target="_blank" rel="noreferrer">Code and data</a> ·{' '}
                    <a href={paper.foresightUrl} target="_blank" rel="noreferrer">Anchor Console</a>
                </p>
                <ul className="research-points">
                    {paper.points.map((point) => (
                        <li key={point.lead}><strong>{point.lead}</strong> {point.text}</li>
                    ))}
                </ul>
            </aside>
            <section className="research-reader" aria-label="Preprint pages">
                <ol className="research-pages">
                    {paper.pageImages.map((img, i) => (
                        <li key={img.src}>
                            <a href={`${paper.pdf}#page=${i + 1}`} target="_blank" rel="noreferrer" aria-label={`Open page ${i + 1} of ${paper.pages} in the PDF`}>
                                <img src={img.src} width={img.w} height={img.h} loading={i < 2 ? 'eager' : 'lazy'} alt={`Page ${i + 1} of ${paper.pages}`} />
                            </a>
                        </li>
                    ))}
                </ol>
            </section>
        </article>
    );
};

export default ResearchView;
