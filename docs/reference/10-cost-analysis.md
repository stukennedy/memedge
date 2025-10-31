# Cost Analysis

[← Back to Performance](09-performance.md) | [Next: Unique Advantages →](11-unique-advantages.md)

---

## Memedge Monthly Costs

### Per 100k requests

**Cloudflare Workers:**
- 100,000 requests @ $0.15/million = $0.01
- CPU time ~20ms/req @ $0.02/million ms = $40.00

**Durable Objects:**
- 100,000 requests @ $0.15/million = $0.01
- Duration ~100ms/req @ $12.50/million ms = $125.00

**Cloudflare AI (embeddings):**
- ~1,000 embedding calls @ $0.011/1000 = $0.01
- (Cached, only for new blocks)

**Storage (Durable Objects):**
- ~5MB per agent * 100 agents = $0.50
- @ $0.20/GB/month

**LLM Costs (external):**
- GPT-4: ~$50-100/month (varies by usage)
- Gemini: ~$20-40/month (cheaper)
- Cloudflare AI: ~$5-10/month (cheapest)

### Totals

**TOTAL (excluding LLM): ~$165/month**  
**TOTAL (including LLM): ~$185-265/month**

**With Cloudflare free tier (10M requests, 30GB storage):**
- First 100k requests: Mostly FREE
- Only LLM costs apply: ~$20-100/month

---

## Letta's Estimated Monthly Costs

### Per 100k requests

**Compute (AWS/GCP):**
- 2x EC2 m5.large instances = $150/month
- (8vCPU, 32GB RAM for redundancy)

**Database (PostgreSQL):**
- RDS db.t3.medium (managed) = $60/month
- (2vCPU, 4GB RAM, 100GB storage)

**Vector Database (Chroma/Pinecone):**
- Pinecone standard tier = $70/month
- (1M vectors, 768 dims)

**Redis Cache:**
- ElastiCache t3.small = $30/month
- (1.5GB RAM)

**Load Balancer:**
- ALB = $20/month

**Data Transfer:**
- Outbound traffic ~50GB = $5/month

**LLM Costs (external):**
- Similar to ours = $50-100/month

**Monitoring/Logging:**
- CloudWatch, etc. = $10/month

### Totals

**TOTAL (excluding LLM): ~$345/month**  
**TOTAL (including LLM): ~$395-445/month**

*Note: This is a conservative estimate for modest scale. Large-scale deployments would cost significantly more.*

---

## Cost Comparison Summary

| Category | Memedge | Letta | Savings |
|----------|---------|-------|---------|
| **Infrastructure** | ~$165/month | ~$345/month | **52% cheaper** |
| **With LLM** | ~$185-265/month | ~$395-445/month | **50-60% cheaper** |
| **With Free Tier** | ~$20-100/month | ~$395-445/month | **75-95% cheaper** |
| **At Scale (1M req)** | ~$1,650/month | ~$1,500-2,000/month | Comparable |
| **Scaling Costs** | Linear with usage | Step function (servers) | Better at small scale |

**Cost Winner: Memedge (for small to medium scale)** - Significantly cheaper for typical use cases. Letta becomes competitive at very large scale due to economies of scale with dedicated infrastructure.

---

## Key Cost Advantages

### 1. No External Services
- No separate vector database costs
- No Redis/caching service fees
- No external PostgreSQL charges
- Single Cloudflare bill

### 2. Pay-Per-Use Model
- Zero idle costs
- No minimum fees
- Scales to zero
- Only pay for actual usage

### 3. Free Tier Friendly
- 10M requests/month free
- 30GB storage free
- Most small projects run entirely free
- Only LLM costs for low-traffic apps

### 4. Predictable Scaling
- Linear cost growth with usage
- No sudden "add more servers" costs
- Transparent pricing calculator
- No surprise bills

---

[← Back to Performance](09-performance.md) | [Next: Unique Advantages →](11-unique-advantages.md)

