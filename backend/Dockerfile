# ==============================================================================
# SettleHub backend image, tuned for Render's free plan (0.1 CPU, 512 MB RAM)
#
# Render puts free services to sleep after 15 idle minutes, so every first request
# pays for a JVM start. On 0.1 CPU that start is dominated by class loading and JIT,
# which this image cuts down with:
#   - Class Data Sharing (CDS): a training run at build time records the loaded
#     classes into application.jsa, which the real start maps in instead of
#     parsing and verifying them again.
#   - C1 only (TieredStopAtLevel=1) and SerialGC: less background CPU and memory
#     than C2 and G1 on a single throttled core.
# ==============================================================================

# Stage 1: build the jar
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder
WORKDIR /build

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S settlehub && adduser -S settlehub -G settlehub

# The same flags are used for the training run and at runtime; CDS needs them to match.
ENV JAVA_TOOL_OPTIONS="-XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:MaxRAMPercentage=75.0 -Xss512k -XX:+ExitOnOutOfMemoryError"
ENV PORT=8080

COPY --from=builder /build/target/settlehub-backend-*.jar settlehub.jar

# Unpack into the layout CDS needs, then do a training run that starts the
# application context and exits. No DATABASE_URL is set here, so the run uses the
# in-memory H2 database and needs no network or secrets.
RUN java -Djarmode=tools -jar settlehub.jar extract --destination application \
    && rm settlehub.jar \
    && java -XX:ArchiveClassesAtExit=application/application.jsa -Dspring.context.exit=onRefresh \
         -jar application/settlehub.jar \
    && chown -R settlehub:settlehub application

USER settlehub:settlehub
EXPOSE 8080

ENTRYPOINT ["java", "-XX:SharedArchiveFile=application/application.jsa", "-Xshare:auto", "-jar", "application/settlehub.jar"]
