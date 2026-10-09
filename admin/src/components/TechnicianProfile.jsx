import React, { useEffect, useMemo, useState } from "react";
import { Dropdown } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import {
  FiPlus,
  FiUserPlus,
  FiChevronRight,
  FiChevronDown,
  FiArrowLeft,
  FiEdit2,
  FiGrid,
  FiBriefcase,
  FiBarChart2,
  FiFolder,
  FiDollarSign,
  FiActivity,
  FiMapPin,
  FiClock,
  FiStar,
  FiCheckCircle,
  FiFileText,
  FiDownload,
  FiMaximize,
  FiExternalLink,
  FiSearch,
  FiFilter,
  FiUser,
  FiMail,
  FiPhone,
  FiCalendar,
  FiTool,
  FiMessageSquare,
  FiShield,
} from "react-icons/fi";
import adminApi from "../services/adminApi";
import { getImageUrl } from "../utils/helpers";
import { errorMessage } from "./TechnicianFormModal";
import AdminImage from "./AdminImage";
import "../styles/TechnicianProfile.css";

const dateText = (value) =>
  value && Number.isFinite(new Date(value).getTime())
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "—";
const amountText = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
const shortId = (value) =>
  value ? `JB-${String(value).slice(-6).toUpperCase()}` : "—";
const jobDate = (job) => job.scheduledDate || job.jobDate?.from;
const completed = (job) => ["completed", "closed"].includes(job.status);
const jobStatus = {
  assigned: "Upcoming",
  ontheway: "On the way",
  visited: "On site",
  inprogress: "In Progress",
  "in-progress": "In Progress",
  checkout: "Checkout",
  completed: "Completed",
  closed: "Completed",
  cancelled: "Cancelled",
};
function Status({ value, label }) {
  return (
    <span className={`tp-status tp-status-${value}`}>{label || value}</span>
  );
}
function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`tp-panel ${className}`}>
      <div className="tp-panel-heading">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
function Empty({ children }) {
  return (
    <div className="tp-empty">
      <FiFileText />
      <p>{children}</p>
    </div>
  );
}
function InfoRows({ rows }) {
  return (
    <dl className="tp-info">
      {rows.map(([Icon, label, value]) => (
        <div key={label}>
          <dt>
            <Icon />
            {label}
          </dt>
          <dd>{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
function Reviews({ reviews, expanded = false, onViewAll }) {
  return (
    <Panel
      title="Recent Reviews"
      action={
        onViewAll && (
          <button className="tp-text-button" onClick={onViewAll}>
            View All
          </button>
        )
      }
    >
      <div className={expanded ? "tp-reviews-grid" : "tp-reviews-list"}>
        {reviews.length ? (
          reviews.slice(0, expanded ? reviews.length : 3).map((review) => (
            <article className="tp-review" key={review.id}>
              <header>
                <span className="tp-review-avatar">{review.initials}</span>
                <div>
                  <strong>{review.name}</strong>
                  <div
                    className="tp-stars"
                    aria-label={`${review.score} out of 5 stars`}
                  >
                    {"★".repeat(Math.round(review.score))}
                    <span>{"★".repeat(5 - Math.round(review.score))}</span>
                  </div>
                </div>
              </header>
              <p>{review.text || "No written review."}</p>
              <footer>
                <span>
                  {review.job
                    ? `Job #${shortId(review.job)}`
                    : "Customer review"}
                </span>
                <span>{dateText(review.date)}</span>
              </footer>
            </article>
          ))
        ) : (
          <Empty>No reviews yet.</Empty>
        )}
      </div>
    </Panel>
  );
}
function Activity({ events, compact = false, onViewAll }) {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const filtered = events.filter(
    (event) =>
      (!search ||
        `${event.text} ${event.category}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!date || event.date.slice(0, 10) === date),
  );
  const items = compact ? filtered.slice(0, 5) : filtered;
  return (
    <Panel
      title={compact ? "Recent Activity" : "Activity"}
      className={compact ? "" : "tp-activity-panel"}
      action={
        compact ? (
          <button className="tp-text-button" onClick={onViewAll}>
            View All
          </button>
        ) : (
          <div className="tp-toolbar">
            <input
              type="date"
              aria-label="Activity date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <label className="tp-search">
              <FiSearch />
              <input
                placeholder="Search activity..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
        )
      }
    >
      {items.length ? (
        <div className={compact ? "tp-activity-compact" : "tp-timeline"}>
          {[...new Set(items.map((item) => item.date.slice(0, 10)))].map(
            (day) => (
              <div key={day}>
                {!compact && <h4>{dateText(day)}</h4>}
                {items
                  .filter((item) => item.date.startsWith(day))
                  .map((event) => (
                    <div className="tp-event" key={event.id}>
                      {!compact && (
                        <time>
                          {new Date(event.date).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "UTC",
                          })}
                        </time>
                      )}
                      <span
                        className={`tp-event-icon tp-event-${event.category.replace(/ /g, "").toLowerCase()}`}
                      >
                        <event.Icon />
                      </span>
                      <p>{event.text}</p>
                      {compact ? (
                        <small>{dateText(event.date)}</small>
                      ) : (
                        <span className="tp-event-category">
                          {event.category}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            ),
          )}
        </div>
      ) : (
        <Empty>No recorded activity matches these filters.</Empty>
      )}
    </Panel>
  );
}
function Jobs({ jobs }) {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [filterOpen, setFilterOpen] = useState(false);
  const matches = (job, key) =>
    key === "all" ||
    (key === "completed"
      ? completed(job)
      : key === "cancelled"
        ? job.status === "cancelled"
        : key === "upcoming"
          ? job.status === "assigned"
          : [
              "ontheway",
              "visited",
              "inprogress",
              "in-progress",
              "checkout",
            ].includes(job.status));
  const filtered = jobs
    .filter(
      (job) =>
        matches(job, tab) &&
        `${shortId(job._id)} ${job.title} ${job.category} ${job.sourceBooking?.user?.name || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!from || jobDate(job)?.slice(0, 10) >= from) &&
        (!to || jobDate(job)?.slice(0, 10) <= to),
    )
    .sort((a, b) =>
      String(jobDate(b) || "").localeCompare(String(jobDate(a) || "")),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * size, current * size);
  return (
    <section className="tp-panel tp-table-panel">
      <div className="tp-jobs-toolbar">
        <div className="tp-segments">
          {[
            ["all", "All Jobs"],
            ["active", "Active"],
            ["upcoming", "Upcoming"],
            ["completed", "Completed"],
            ["cancelled", "Cancelled"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => {
                setTab(key);
                setPage(1);
              }}
            >
              {label}
              {key !== "all" &&
                ` (${jobs.filter((job) => matches(job, key)).length})`}
            </button>
          ))}
        </div>
        <div className="tp-toolbar">
          <button
            className="tp-outline"
            onClick={() => setFilterOpen((v) => !v)}
            aria-expanded={filterOpen}
          >
            <FiFilter /> Filter / Date Range
          </button>
          <label className="tp-search">
            <FiSearch />
            <input
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
      </div>
      {filterOpen && (
        <div className="tp-date-filters">
          <label>
            From
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <button
            className="tp-text-button"
            onClick={() => {
              setFrom("");
              setTo("");
              setSearch("");
              setPage(1);
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      <div className="tp-table-scroll">
        <table className="tp-table">
          <thead>
            <tr>
              {[
                "Job ID",
                "Service",
                "Customer",
                "Scheduled",
                "Status",
                "Amount",
                "Action",
              ].map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((job) => (
                <tr key={job._id}>
                  <td>{shortId(job._id)}</td>
                  <td>{job.title || job.category}</td>
                  <td>{job.sourceBooking?.user?.name || "—"}</td>
                  <td>
                    {dateText(jobDate(job))}
                    {jobDate(job) && (
                      <small>
                        {new Date(jobDate(job)).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "UTC",
                        })}
                      </small>
                    )}
                  </td>
                  <td>
                    <Status
                      value={completed(job) ? "completed" : job.status}
                      label={jobStatus[job.status] || job.status}
                    />
                  </td>
                  <td>{amountText(job.finalPrice || job.pay?.fixedAmount)}</td>
                  <td>
                    <Link
                      className="tp-view"
                      to={`/technician-jobs?jobId=${job._id}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <Empty>No jobs match these filters.</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="tp-pagination">
        <span>
          Showing {filtered.length ? (current - 1) * size + 1 : 0} to{" "}
          {Math.min(current * size, filtered.length)} of {filtered.length} jobs
        </span>
        <div>
          <button disabled={current === 1} onClick={() => setPage(current - 1)}>
            ‹
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === pages || Math.abs(n - current) < 2)
            .map((n) => (
              <button
                key={n}
                className={n === current ? "active" : ""}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
          <button
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            ›
          </button>
        </div>
        <select
          aria-label="Jobs per page"
          value={size}
          onChange={(e) => {
            setSize(Number(e.target.value));
            setPage(1);
          }}
        >
          {[10, 20, 50].map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
function Documents({ technician, onRequest }) {
  const documents = technician.documents || [];
  const [selectedId, setSelectedId] = useState(documents[0]?.documentId);
  const [imageFailed, setImageFailed] = useState(false);
  const selected = documents.find(
    (document) => document.documentId === selectedId,
  );
  const url = getImageUrl(selected?.s3Key);
  const image = url && !/\.(pdf|docx?)(?:\?|$)/i.test(url);
  useEffect(() => setImageFailed(false), [selectedId]);
  return (
    <div className="tp-documents-layout">
      <div className="tp-stack">
        <section className="tp-verification-banner">
          <FiShield />
          <div>
            <span>Verification Status</span>
            <strong>
              {technician.verificationStatus === "approved"
                ? "VERIFIED"
                : (technician.verificationStatus || "pending")
                    .replace("-", " ")
                    .toUpperCase()}
            </strong>
            <p>
              {documents.filter((d) => d.status === "approved").length} /{" "}
              {documents.length} Documents Approved
            </p>
            <small>
              Last reviewed: {dateText(technician.verificationReviewedAt)}
            </small>
          </div>
        </section>
        <Panel
          title="All Documents"
          className="tp-table-panel"
          action={
            <button
              className="tp-outline tp-request"
              disabled={!onRequest}
              onClick={onRequest}
            >
              Request Document
            </button>
          }
        >
          <div className="tp-table-scroll">
            <table className="tp-table">
              <thead>
                <tr>
                  {[
                    "Document Type",
                    "Uploaded On",
                    "Expiry Date",
                    "Status",
                    "Action",
                  ].map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.length ? (
                  documents.map((document) => (
                    <tr key={document.documentId}>
                      <td>{document.label || document.documentId}</td>
                      <td>{dateText(document.uploadedAt)}</td>
                      <td>{dateText(document.expiryDate)}</td>
                      <td>
                        <Status
                          value={document.status}
                          label={
                            document.status === "approved"
                              ? "Approved"
                              : document.status
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="tp-outline"
                          aria-pressed={selectedId === document.documentId}
                          onClick={() => setSelectedId(document.documentId)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <Empty>No documents uploaded.</Empty>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Certificates">
          {technician.certificateImages?.length ? (
            <div className="tp-certificate-gallery">
              {technician.certificateImages
                .filter(Boolean)
                .map((image, index) => (
                  <a
                    className="tp-certificate"
                    key={`${image}-${index}`}
                    href={getImageUrl(image)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open certificate ${index + 1}`}
                  >
                    <AdminImage
                      src={getImageUrl(image)}
                      alt={`Certificate ${index + 1}`}
                      width={160}
                      height={112}
                      objectFit="contain"
                    />
                    <span>
                      Certificate {index + 1}{" "}
                      <FiExternalLink aria-hidden="true" />
                    </span>
                  </a>
                ))}
            </div>
          ) : (
            <Empty>No certificates uploaded.</Empty>
          )}
        </Panel>
      </div>
      <Panel
        title="Document Preview"
        action={
          url && (
            <div className="tp-toolbar">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label="Download document"
              >
                <FiDownload />
              </a>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label="Open full document"
              >
                <FiMaximize />
              </a>
            </div>
          )
        }
        className="tp-document-preview"
      >
        {selected ? (
          <>
            <div className="tp-preview-media">
              {image && !imageFailed ? (
                <img
                  src={url}
                  alt={selected.label || "Technician document"}
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <Empty>
                  {url
                    ? "Open the document to view this file."
                    : "Document file unavailable."}
                </Empty>
              )}
            </div>
            <h3>{selected.label || selected.documentId}</h3>
            <InfoRows
              rows={[
                [FiClock, "Uploaded", dateText(selected.uploadedAt)],
                [FiCalendar, "Expiry", dateText(selected.expiryDate)],
              ]}
            />
            <Status
              value={selected.status}
              label={
                selected.status === "approved" ? "Approved" : selected.status
              }
            />
            {selected.rejectionReason && <p>{selected.rejectionReason}</p>}
            {url && (
              <a
                className="tp-outline tp-full-document"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                View Full Document <FiExternalLink />
              </a>
            )}
          </>
        ) : (
          <Empty>Select a document to preview.</Empty>
        )}
      </Panel>
    </div>
  );
}
function Performance({ jobs, reviews, ratings }) {
  const [period, setPeriod] = useState("month");
  const trend = useMemo(() => {
    const now = new Date();
    const count =
      period === "month"
        ? new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate()
        : 12;
    return Array.from({ length: count }, (_, i) => ({
      label:
        period === "month"
          ? String(i + 1)
          : new Date(Date.UTC(now.getUTCFullYear(), i, 1)).toLocaleDateString(
              "en-US",
              { month: "short", timeZone: "UTC" },
            ),
      jobs: jobs.filter((job) => {
        const date = new Date(job.completedAt || job.jobCompletedAt);
        return (
          completed(job) &&
          date.getUTCFullYear() === now.getUTCFullYear() &&
          (period === "month"
            ? date.getUTCMonth() === now.getUTCMonth() &&
              date.getUTCDate() === i + 1
            : date.getUTCMonth() === i)
        );
      }).length,
    }));
  }, [jobs, period]);
  const services = [
    ...new Set(jobs.map((job) => job.category || "General Service")),
  ].map((service) => {
    const items = jobs.filter(
      (job) => (job.category || "General Service") === service,
    );
    const scores = items
      .map((job) => job.technicianRating?.score)
      .filter(Number.isFinite);
    return {
      service,
      jobs: items.length,
      completion: Math.round(
        (items.filter(completed).length / items.length) * 100,
      ),
      rating: scores.length
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        : "—",
    };
  });
  return (
    <div className="tp-performance-layout">
      <Panel
        title="Job Completion Trend"
        action={
          <select
            aria-label="Completion trend period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        }
      >
        <div className="tp-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
              <Tooltip />
              <Area
                isAnimationActive={false}
                type="linear"
                dataKey="jobs"
                stroke="#3983ff"
                fill="#eaf2ff"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel
        title="Rating Breakdown"
        action={<small>Total Reviews: {ratings.length}</small>}
      >
        <div className="tp-rating-breakdown">
          {[5, 4, 3, 2, 1].map((score) => {
            const percent = ratings.length
              ? Math.round(
                  (ratings.filter(
                    (rating) => Math.round(rating.score) === score,
                  ).length /
                    ratings.length) *
                    100,
                )
              : 0;
            return (
              <div key={score}>
                <span>
                  {score} <FiStar />
                </span>
                <progress max="100" value={percent} />
                <span>{percent}%</span>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="Service Performance">
        <div className="tp-table-scroll">
          <table className="tp-table tp-service-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Jobs</th>
                <th>Completion Rate</th>
                <th>Avg. Rating</th>
              </tr>
            </thead>
            <tbody>
              {services.length ? (
                services.map((service) => (
                  <tr key={service.service}>
                    <td>{service.service}</td>
                    <td>{service.jobs}</td>
                    <td>{service.completion}%</td>
                    <td>{service.rating}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>
                    <Empty>No service performance recorded.</Empty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <Reviews reviews={reviews} expanded />
    </div>
  );
}
function Financials({ financial, jobs, loading, error, onRetry }) {
  const [period, setPeriod] = useState("year");
  const [all, setAll] = useState(false);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  useEffect(() => {
    if (!all || !financial) return;
    let active = true;
    setHistoryLoading(true);
    setHistoryError("");
    adminApi
      .getTechnicianFinancials(financial.technicianId, {
        page,
        limit: 10,
        status,
      })
      .then((res) => {
        if (active) setHistory(res.data.transactions);
      })
      .catch((err) => {
        if (active) setHistoryError(errorMessage(err));
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [all, financial, page, status]);
  if (loading) return <Empty>Loading financials…</Empty>;
  if (error)
    return (
      <div role="alert" className="tp-error">
        {error}
        <button className="tp-outline" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  if (!financial) return null;
  const summary = financial.summary;
  const now = new Date();
  const chart =
    period === "year"
      ? Array.from({ length: now.getUTCMonth() + 1 }, (_, month) => ({
          label: new Date(
            Date.UTC(now.getUTCFullYear(), month, 1),
          ).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
          amount: jobs
            .filter(
              (job) =>
                job.payment?.status === "paid" &&
                new Date(
                  job.payment.paidAt || job.completedAt || job.updatedAt,
                ).getUTCFullYear() === now.getUTCFullYear() &&
                new Date(
                  job.payment.paidAt || job.completedAt || job.updatedAt,
                ).getUTCMonth() === month,
            )
            .reduce((sum, job) => sum + Number(job.finalPrice || 0), 0),
        }))
      : financial.activity.points;
  const transactions = all
    ? history?.items || []
    : financial.recentTransactions;
  return (
    <div className="tp-financials">
      <div className="tp-financial-cards">
        {[
          ["Total Earnings", summary.totalEarned, "All time"],
          [
            "This Month Earnings",
            summary.thisMonth,
            now.toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            }),
          ],
          [
            "Pending Payout",
            summary.pendingWithdrawals,
            `${financial.withdrawals.filter((item) => item.status === "pending").length} transactions`,
          ],
          ["Total Paid Out", summary.totalWithdrawn, "All time"],
        ].map(([label, value, caption]) => (
          <section key={label}>
            <h3>{label}</h3>
            <strong>{amountText(value)}</strong>
            <p>{caption}</p>
          </section>
        ))}
      </div>
      <div className="tp-earnings-layout">
        <Panel
          title="Earnings Overview"
          action={
            <select
              aria-label="Earnings chart period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="year">This Year</option>
              <option value="month">This Month</option>
            </select>
          }
        >
          <div className="tp-chart tp-bar-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid vertical={false} stroke="#f0f2f5" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#835722" }}
                  minTickGap={15}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={50}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip formatter={amountText} />
                <Bar
                  isAnimationActive={false}
                  dataKey="amount"
                  fill="#a7732c"
                  radius={[12, 12, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="tp-wallet-detail">
            <span>
              Available Balance{" "}
              <strong>{amountText(summary.availableBalance)}</strong>
            </span>
            <span>
              Pending Job Earnings{" "}
              <strong>{amountText(summary.pendingEarnings)}</strong>
            </span>
          </div>
        </Panel>
        <Panel
          title="Earnings Transactions"
          className="tp-table-panel"
          action={
            <button
              className="tp-text-button"
              onClick={() => {
                setAll((v) => !v);
                setPage(1);
              }}
            >
              {all ? "Recent Transactions" : "View All Transactions"}{" "}
              <FiChevronRight />
            </button>
          }
        >
          {all && (
            <div className="tp-date-filters">
              <label>
                Status
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All</option>
                  <option value="completed">Paid</option>
                  <option value="pending">Pending</option>
                </select>
              </label>
            </div>
          )}
          {historyLoading && all ? (
            <Empty>Loading transactions…</Empty>
          ) : historyError && all ? (
            <p className="tp-error" role="alert">
              {historyError}
            </p>
          ) : (
            <div className="tp-table-scroll">
              <table className="tp-table">
                <thead>
                  <tr>
                    {[
                      "Date",
                      "Job ID",
                      "Gross",
                      "Platform Fee",
                      "Net",
                      "Status",
                    ].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.length ? (
                    transactions.map((item) => {
                      const job = jobs.find(
                        (job) => String(job._id) === item.jobId,
                      );
                      return (
                        <tr key={item.id}>
                          <td>{dateText(item.date)}</td>
                          <td>
                            <Link to={`/technician-jobs?jobId=${item.jobId}`}>
                              {shortId(item.jobId)}
                            </Link>
                          </td>
                          <td>
                            {amountText(
                              job?.payment?.status === "paid"
                                ? job.payment.basePrice
                                : item.amount,
                            )}
                          </td>
                          <td title="Platform fees are not recorded for technician jobs">
                            —
                          </td>
                          <td>
                            <strong>{amountText(item.amount)}</strong>
                          </td>
                          <td>
                            <Status
                              value={
                                item.status === "completed" ? "paid" : "pending"
                              }
                              label={
                                item.status === "completed" ? "Paid" : "Pending"
                              }
                            />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <Empty>No earnings transactions.</Empty>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {all && (
            <div className="tp-pagination">
              <button
                disabled={page === 1 || historyLoading}
                onClick={() => setPage((v) => v - 1)}
              >
                ‹
              </button>
              <span>Page {page}</span>
              <button
                disabled={!history?.pagination.hasNextPage || historyLoading}
                onClick={() => setPage((v) => v + 1)}
              >
                ›
              </button>
            </div>
          )}
        </Panel>
      </div>
      {financial.withdrawals.length > 0 && (
        <Panel title="Payout History" className="tp-table-panel">
          <div className="tp-table-scroll">
            <table className="tp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {financial.withdrawals.map((item) => (
                  <tr key={item.id}>
                    <td>{dateText(item.createdAt)}</td>
                    <td>{amountText(item.amount)}</td>
                    <td>{item.method}</td>
                    <td>
                      <Status value={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

export default function TechnicianProfile({
  technician,
  jobs,
  canWrite,
  onClose,
  onEdit,
  onAction,
  onAdd,
  onInvite,
  onNoteSaved,
}) {
  const [tab, setTab] = useState("overview");
  const [financial, setFinancial] = useState(null);
  const [financialLoading, setFinancialLoading] = useState(true);
  const [financialError, setFinancialError] = useState("");
  const [retry, setRetry] = useState(0);
  const [note, setNote] = useState(technician.adminNote || "");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  useEffect(() => {
    let active = true;
    setFinancialLoading(true);
    setFinancialError("");
    adminApi
      .getTechnicianFinancials(technician._id, { period: "monthly" })
      .then((result) => {
        if (active) setFinancial(result.data);
      })
      .catch((err) => {
        if (active) setFinancialError(errorMessage(err));
      })
      .finally(() => {
        if (active) setFinancialLoading(false);
      });
    return () => {
      active = false;
    };
  }, [technician._id, retry]);
  const technicianJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          String(job.assignedTechnician?._id || "") === String(technician._id),
      ),
    [jobs, technician._id],
  );
  const documents = technician.documents || [];
  const ratings = [
    ...(technician.workOrderRatings || []),
    ...(technician.customerBookingRatings || []),
  ];
  const reviews = ratings
    .map((rating, i) => ({
      id: `${rating.job || rating.booking}-${i}`,
      job: rating.job,
      score: rating.score,
      name: rating.customer?.name || (rating.job ? "Admin review" : "Customer"),
      initials:
        rating.customer?.name
          ?.split(/\s+/)
          .map((word) => word[0])
          .slice(0, 2)
          .join("") || (rating.job ? "AD" : "CU"),
      text: rating.review,
      date: rating.ratedAt,
    }))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const events = useMemo(() => {
    const items = [];
    technicianJobs.forEach((job) => {
      (job.statusHistory || []).forEach((entry, i) => {
        if (entry.changedAt)
          items.push({
            id: `${job._id}-status-${i}`,
            date: entry.changedAt,
            text: `Job #${shortId(job._id)} ${jobStatus[entry.status] || entry.status}`,
            category: "Job Management",
            Icon: FiBriefcase,
          });
      });
      if (job.payment?.paidAt)
        items.push({
          id: `${job._id}-paid`,
          date: job.payment.paidAt,
          text: `Payment credited – ${amountText(job.finalPrice)}`,
          category: "Payments",
          Icon: FiDollarSign,
        });
    });
    ratings.forEach((rating, i) => {
      if (rating.ratedAt)
        items.push({
          id: `rating-${i}`,
          date: rating.ratedAt,
          text: `Received ${rating.score}-star rating${rating.job ? ` for Job #${shortId(rating.job)}` : ""}`,
          category: "Reviews",
          Icon: FiStar,
        });
    });
    documents.forEach((document) => {
      if (document.uploadedAt)
        items.push({
          id: `document-${document.documentId}`,
          date: document.uploadedAt,
          text: `${document.label} uploaded`,
          category: "Documents",
          Icon: FiFileText,
        });
    });
    if (technician.createdAt)
      items.push({
        id: "joined",
        date: technician.createdAt,
        text: "Technician account created",
        category: "Account",
        Icon: FiUser,
      });
    return items.sort((a, b) => b.date.localeCompare(a.date));
    // The selected profile remains fixed while this workspace is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [technicianJobs, technician]);
  const saveNote = async (event) => {
    event.preventDefault();
    setNoteSaving(true);
    setNoteError("");
    try {
      const result = await adminApi.saveTechnicianNote(
        technician._id,
        noteDraft,
      );
      setNote(result.data.note);
      onNoteSaved?.(result.data.note);
      setEditingNote(false);
    } catch (error) {
      setNoteError(errorMessage(error));
    } finally {
      setNoteSaving(false);
    }
  };
  const completionRate = technicianJobs.length
    ? Math.round(
        (technicianJobs.filter(completed).length / technicianJobs.length) * 100,
      )
    : null;
  const monthJobs = technicianJobs.filter(
    (job) =>
      completed(job) &&
      String(job.completedAt || job.jobCompletedAt || "").startsWith(
        new Date().toISOString().slice(0, 7),
      ),
  ).length;
  const verified = technician.verificationStatus === "approved";
  const edit = (
    <button className="tp-mini-edit" disabled={!canWrite} onClick={onEdit}>
      <FiEdit2 /> Edit
    </button>
  );
  const tabs = [
    ["overview", "Overview", FiGrid],
    ["jobs", "Jobs", FiBriefcase],
    ["performance", "Performance", FiBarChart2],
    ["documents", "Documents", FiFolder],
    ["earnings", "Earnings & Payouts", FiDollarSign],
    ["activity", "Activity", FiActivity],
  ];
  return (
    <div className="tp-workspace">
      <header className="tp-header">
        <div>
          <nav className="tp-breadcrumb">
            <span>Field Operations</span>
            <FiChevronRight />
            <button onClick={onClose}>Technicians</button>
            <FiChevronRight />
            <strong>Technician Profile / {technician.name}</strong>
          </nav>
          <h1>Technician’s Profile</h1>
          <p>Manage and monitor technician’s activities.</p>
        </div>
        <div className="tp-header-actions">
          <button className="tp-primary" disabled={!canWrite} onClick={onAdd}>
            <FiPlus /> Add Technician
          </button>
          <button className="tp-soft" disabled={!canWrite} onClick={onInvite}>
            <FiUserPlus /> Invite Technician
          </button>
        </div>
      </header>
      <section className="tp-profile-banner">
        <div className="tp-avatar">
          {technician.photoUrl && !avatarFailed ? (
            <img
              src={getImageUrl(technician.photoUrl)}
              alt={technician.name}
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <span>
              {technician.name
                ?.split(/\s+/)
                .map((word) => word[0])
                .slice(0, 2)
                .join("")}
            </span>
          )}
        </div>
        <div className="tp-profile-name">
          <h2>
            {technician.name}
            <Status
              value={
                verified
                  ? "verified"
                  : technician.verificationStatus || "pending"
              }
              label={
                verified
                  ? "♧ Verified"
                  : technician.verificationStatus || "Pending"
              }
            />
          </h2>
          <p>
            {technician.technicianId} <span>•</span>{" "}
            {technician.primaryService || "—"}
          </p>
          <p>
            <FiMapPin />
            {technician.serviceArea || "—"}
          </p>
          <div className="tp-online-row">
            <Status
              value={technician.isOnline ? "online" : "offline"}
              label={`● ${technician.isOnline ? "Online" : "Offline"}`}
            />
            <span>Last active: {technician.isOnline ? "Now" : "—"}</span>
          </div>
        </div>
        <div className="tp-banner-actions">
          <button className="tp-outline" disabled={!canWrite} onClick={onEdit}>
            <FiEdit2 /> Edit Profile
          </button>
          <Dropdown>
            <Dropdown.Toggle className="tp-actions-toggle">
              <span>Actions</span>
              <FiChevronDown aria-hidden="true" />
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={onClose}>
                <FiArrowLeft /> Back to technicians
              </Dropdown.Item>
              <Dropdown.Item
                disabled={!canWrite}
                onClick={() => onAction("assign")}
              >
                Assign to Job
              </Dropdown.Item>
              <Dropdown.Item
                disabled={!canWrite}
                onClick={() => onAction("message")}
              >
                Message Technician
              </Dropdown.Item>
              <Dropdown.Item
                as={Link}
                to={`/technician-verification?technician=${technician._id}`}
              >
                Verify Documents
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item
                disabled={!canWrite}
                onClick={() => onAction("suspend")}
              >
                {["suspended", "blocked"].includes(technician.accountStatus)
                  ? "Restore"
                  : "Suspend"}{" "}
                Account
              </Dropdown.Item>
              <Dropdown.Item
                disabled={!canWrite}
                onClick={() => onAction("inactive")}
              >
                {technician.accountStatus === "inactive"
                  ? "Activate"
                  : "Deactivate"}{" "}
                Account
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </section>
      <div className="tp-metrics">
        {[
          [
            FiStar,
            "Rating",
            technician.rating == null
              ? "—"
              : `${Number(technician.rating).toFixed(1)} / 5`,
            `${technician.ratingCount || 0} Reviews`,
            "yellow",
          ],
          [
            FiBriefcase,
            "Total Jobs",
            technician.totalJobsDone || 0,
            `+${monthJobs} this month`,
            "blue",
          ],
          [
            FiActivity,
            "Completion Rate",
            completionRate == null ? "—" : `${completionRate}%`,
            "Based on assigned jobs",
            "purple",
          ],
          [
            FiDollarSign,
            "Total Earnings",
            financialLoading
              ? "…"
              : financial
                ? amountText(financial.summary.totalEarned)
                : "—",
            financial
              ? `This month: ${amountText(financial.summary.thisMonth)}`
              : financialError
                ? "Unable to load earnings"
                : "This month: —",
            "green",
          ],
          [
            FiClock,
            "Avg Response Time",
            "—",
            "No response data recorded",
            "indigo",
          ],
        ].map(([Icon, label, value, caption, color]) => (
          <section className={`tp-metric tp-metric-${color}`} key={label}>
            <span className="tp-metric-icon">
              <Icon />
            </span>
            <div>
              <h3>{label}</h3>
              <strong>{value}</strong>
              <p>{caption}</p>
            </div>
          </section>
        ))}
      </div>
      <div
        className="tp-tabs"
        role="tablist"
        aria-label="Technician profile sections"
      >
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            id={`tp-tab-${key}`}
            role="tab"
            aria-selected={tab === key}
            aria-controls={`tp-panel-${key}`}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`tp-panel-${tab}`}
        aria-labelledby={`tp-tab-${tab}`}
        className="tp-body"
      >
        {tab === "overview" && (
          <div className="tp-overview-layout">
            <Panel title="Professional Bio" className="tp-bio-panel">
              <p className="tp-professional-bio">
                {technician.professionalBio?.trim()
                  ? technician.professionalBio
                  : "No professional bio provided."}
              </p>
            </Panel>
            <div className="tp-stack">
              <Panel title="Personal Information" action={edit}>
                <InfoRows
                  rows={[
                    [FiUser, "Full Name", technician.name],
                    [FiMail, "Email", technician.email],
                    [FiPhone, "Phone", technician.phone],
                    [FiCalendar, "DOB", dateText(technician.dateOfBirth)],
                    // [FiUser, "Gender", technician.gender],
                    // [
                    //   FiMapPin,
                    //   "Address",
                    //   technician.address || technician.serviceArea,
                    // ],
                    // [FiShield, "ID Proof Number", technician.idProofNumber],
                  ]}
                />
              </Panel>
              <Panel
                title="Verification Summary"
                action={
                  <button
                    className="tp-text-button"
                    onClick={() => setTab("documents")}
                  >
                    View All →
                  </button>
                }
              >
                <div className="tp-verification-list">
                  {documents.length ? (
                    documents.map((document) => (
                      <div key={document.documentId}>
                        <FiCheckCircle />
                        <span>{document.label}</span>
                        <small
                          className={
                            document.status === "approved" ? "tp-green" : ""
                          }
                        >
                          {document.status}
                        </small>
                      </div>
                    ))
                  ) : (
                    <p>No documents uploaded.</p>
                  )}
                  <footer>
                    {
                      documents.filter(
                        (document) => document.status === "approved",
                      ).length
                    }{" "}
                    / {documents.length} Documents Approved
                  </footer>
                </div>
              </Panel>
            </div>
            <div className="tp-stack">
              <Panel title="Professional Information" action={edit}>
                <InfoRows
                  rows={[
                    [FiBriefcase, "Primary Service", technician.primaryService],
                    [
                      FiClock,
                      "Experience",
                      `${technician.yearsOfExperience || 0} Years`,
                    ],
                    [
                      FiTool,
                      "Skills",
                      <div className="tp-tags">
                        {technician.skills?.length
                          ? technician.skills.map((skill) => (
                              <span key={skill}>{skill}</span>
                            ))
                          : "—"}
                      </div>,
                    ],
                    // [FiMapPin, "Service Areas", technician.serviceArea],
                    [
                      FiMapPin,
                      "Service Radius",
                      `${technician.serviceRadius || 15} km`,
                    ],
                    // [FiFileText, "Languages", technician.languages?.join(", ")],
                    // [FiTool, "Tools / Equipment", technician.tools?.join(", ")],
                  ]}
                />
              </Panel>
              <Panel
                title="Quick Note"
                className="tp-note"
                action={
                  <button
                    className="tp-text-button"
                    disabled={!canWrite}
                    onClick={() => {
                      setNoteDraft(note);
                      setNoteError("");
                      setEditingNote(true);
                    }}
                  >
                    + Add Note
                  </button>
                }
              >
                {editingNote ? (
                  <form onSubmit={saveNote}>
                    <textarea
                      aria-label="Quick note"
                      maxLength={1000}
                      disabled={noteSaving}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                    />
                    <small>Private note for administrators.</small>
                    {noteError && (
                      <p role="alert" className="tp-note-error">
                        {noteError}
                      </p>
                    )}
                    <div className="tp-toolbar">
                      <button
                        className="tp-primary"
                        type="submit"
                        disabled={noteSaving}
                      >
                        {noteSaving ? "Saving…" : "Save Note"}
                      </button>
                      <button
                        className="tp-outline"
                        type="button"
                        disabled={noteSaving}
                        onClick={() => setEditingNote(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : note ? (
                  <p className="tp-note-text">
                    {note}
                    <small>Private admin note</small>
                  </p>
                ) : (
                  <Empty>
                    No notes available
                    <small>Click Add Note to add a note.</small>
                  </Empty>
                )}
              </Panel>
            </div>
            <div className="tp-stack">
              <Panel title="Availability" action={edit}>
                <InfoRows
                  rows={[
                    [
                      FiActivity,
                      "Status",
                      <Status
                        value={technician.isOnline ? "online" : "offline"}
                      />,
                    ],
                    [FiClock, "Working Hours", technician.workingHours],
                    [
                      FiMapPin,
                      "Service Radius",
                      `${technician.serviceRadius || 15} km`,
                    ],
                    // [FiClock, "Last Active", technician.isOnline ? "Now" : "—"],
                    // [
                    //   FiClock,
                    //   "Break Mode",
                    //   technician.breakMode == null
                    //     ? "—"
                    //     : technician.breakMode
                    //       ? "On"
                    //       : "Off",
                    // ],
                    // [
                    //   FiCalendar,
                    //   "Vacation Mode",
                    //   technician.vacationMode == null
                    //     ? "—"
                    //     : technician.vacationMode
                    //       ? "On"
                    //       : "Off",
                    // ],
                  ]}
                />
              </Panel>
              <Activity
                events={events}
                compact
                onViewAll={() => setTab("activity")}
              />
            </div>
            <Reviews
              reviews={reviews}
              onViewAll={() => setTab("performance")}
            />
          </div>
        )}
        {tab === "jobs" && <Jobs jobs={technicianJobs} />}
        {tab === "performance" && (
          <Performance
            jobs={technicianJobs}
            reviews={reviews}
            ratings={ratings}
          />
        )}
        {tab === "documents" && (
          <Documents
            technician={technician}
            onRequest={canWrite ? () => onAction("message") : null}
          />
        )}
        {tab === "earnings" && (
          <Financials
            financial={financial}
            jobs={technicianJobs}
            loading={financialLoading}
            error={financialError}
            onRetry={() => setRetry((v) => v + 1)}
          />
        )}
        {tab === "activity" && <Activity events={events} />}
      </div>
      <Link
        className="tp-quote-chat"
        to={`/technician-chat?technician=${technician._id}`}
      >
        <FiMessageSquare />
        <span>
          Quote
          <br />
          Chat
        </span>
      </Link>
    </div>
  );
}
