CREATE TABLE `jobs` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`archived` enum('true','false') NOT NULL DEFAULT 'false',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `letterConfusionPairs` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`jobId` varchar(64) NOT NULL,
	`originalLetter` varchar(1) NOT NULL,
	`correctedLetter` varchar(1) NOT NULL,
	`count` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `letterConfusionPairs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `letterMorphologyVariants` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`jobId` varchar(64) NOT NULL,
	`letter` varchar(1) NOT NULL,
	`morphology` varchar(255) NOT NULL,
	`context` varchar(255),
	`count` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `letterMorphologyVariants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ocrAccuracyMetrics` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`jobId` varchar(64) NOT NULL,
	`pageId` varchar(64) NOT NULL,
	`totalWords` int NOT NULL,
	`correctWords` int NOT NULL,
	`accuracy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ocrAccuracyMetrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` varchar(64) NOT NULL,
	`jobId` varchar(64) NOT NULL,
	`pageOrder` int NOT NULL,
	`pageLabel` varchar(255),
	`imageUrl` text,
	`archived` enum('true','false') NOT NULL DEFAULT 'false',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wordCorrections` (
	`id` varchar(64) NOT NULL,
	`wordId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`originalText` text NOT NULL,
	`correctedText` text NOT NULL,
	`isUserMarkedScribble` enum('true','false') NOT NULL DEFAULT 'false',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wordCorrections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `words` (
	`id` varchar(64) NOT NULL,
	`pageId` varchar(64) NOT NULL,
	`wordIndex` int NOT NULL,
	`text` text NOT NULL,
	`confidence` int,
	`isFlagged` enum('true','false') NOT NULL DEFAULT 'false',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `words_id` PRIMARY KEY(`id`)
);
